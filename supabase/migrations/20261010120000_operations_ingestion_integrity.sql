-- Reuse the existing batch writer. Connector credentials are source-scoped,
-- hashed externally and provisioned only by a trusted service administrator.
create table public.operations_connector_credentials (
  source_id uuid primary key references public.operations_sources(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  metric_allowlist text[] not null check (cardinality(metric_allowlist) between 1 and 16),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.operations_connector_credentials enable row level security;
revoke all on public.operations_connector_credentials from public, anon, authenticated;
grant all on public.operations_connector_credentials to service_role;

create or replace function public.operations_ingest_measurement_batch(
  p_facility_id uuid, p_source_id uuid, p_batch_id uuid, p_records jsonb
) returns integer language plpgsql security definer set search_path=public as $$
declare
  inserted_count integer;
  source_owner uuid;
  newest timestamptz;
begin
  -- Lock the source: batches for one source serialize, including dedup checks.
  select s.owner_id into source_owner from public.operations_sources s
  join public.operations_facilities f on f.id=s.facility_id and f.owner_id=s.owner_id
  where s.id=p_source_id and s.facility_id=p_facility_id
    and (s.owner_id=auth.uid() or auth.role()='service_role') for update of s;
  if source_owner is null then raise exception using errcode='42501', message='Invalid Operations source scope'; end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' then
    raise exception using errcode='22023', message='Invalid measurement batch';
  end if;
  if jsonb_array_length(p_records) not between 1 and 10000 then
    raise exception using errcode='22023', message='Invalid measurement batch size';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_records) as r(metric_key text, asset_id text,
      event_at timestamptz, interval_seconds integer, value numeric, unit text, source_record_id text)
    where r.event_at is null or r.event_at>now()+interval '5 minutes'
      or r.source_record_id is null or length(r.source_record_id) not between 1 and 300
      or r.asset_id is null or length(r.asset_id) not between 1 and 240
      or r.value is null or r.value::text in ('NaN','Infinity','-Infinity')
      or (r.interval_seconds is not null and r.interval_seconds not between 1 and 86400)
      or case
        when r.metric_key like '%percent' then r.unit is distinct from '%' or r.value not between 0 and 100
        when r.metric_key like '%\_mw' escape '\' then r.unit is distinct from 'MW' or (r.metric_key<>'bess_power_mw' and r.value<0)
        when r.metric_key like '%\_mwh' escape '\' then r.unit is distinct from 'MWh' or r.value<0
        when r.metric_key like '%\_count' escape '\' then r.unit is distinct from 'count' or r.value<0 or r.value<>trunc(r.value)
        when r.metric_key='waste_heat_temperature_c' then r.unit is distinct from 'C' or r.value not between -50 and 200
        else true end
  ) then raise exception using errcode='22023', message='Invalid measurement value or timestamp'; end if;
  -- Reusing an identity with different contents is an error, not a silent update.
  if exists (
    select 1 from jsonb_to_recordset(p_records) as r(metric_key text, asset_id text,
      event_at timestamptz, interval_seconds integer, value numeric, unit text, source_record_id text)
    join public.operations_measurements m on m.source_id=p_source_id
      and m.source_record_id=r.source_record_id and m.metric_key=r.metric_key and m.asset_id=r.asset_id
    where m.event_at is distinct from r.event_at or m.value is distinct from r.value
      or m.unit is distinct from r.unit or m.interval_seconds is distinct from r.interval_seconds
  ) or exists (
    select 1 from jsonb_to_recordset(p_records) as r(metric_key text, asset_id text,
      event_at timestamptz, interval_seconds integer, value numeric, unit text, source_record_id text)
    group by metric_key,asset_id,source_record_id
    having count(distinct (event_at,interval_seconds,value,unit))>1
  ) then raise exception using errcode='22023', message='Conflicting measurement identity'; end if;
  insert into public.operations_measurements (
    facility_id,source_id,metric_key,asset_id,event_at,interval_seconds,value,unit,value_kind,quality,source_record_id,ingestion_batch_id
  ) select p_facility_id,p_source_id,r.metric_key,r.asset_id,r.event_at,r.interval_seconds,
    r.value,r.unit,'observed','accepted',r.source_record_id,p_batch_id
  from jsonb_to_recordset(p_records) as r(metric_key text,asset_id text,event_at timestamptz,
    interval_seconds integer,value numeric,unit text,source_record_id text)
  on conflict (source_id,source_record_id,metric_key,asset_id) do nothing;
  get diagnostics inserted_count=row_count;
  select max((r->>'event_at')::timestamptz) into newest from jsonb_array_elements(p_records) r;
  insert into public.operations_source_watermarks(source_id,facility_id,owner_id,latest_event_at,latest_received_at)
    values(p_source_id,p_facility_id,source_owner,newest,now())
  on conflict(source_id) do update set
    latest_event_at=greatest(operations_source_watermarks.latest_event_at,excluded.latest_event_at),
    latest_received_at=now(),consecutive_failures=0,last_error_code=null,updated_at=now();
  update public.operations_sources set last_received_at=now(),
    health=case when (select latest_event_at from public.operations_source_watermarks where source_id=p_source_id)
      >=now()-make_interval(secs=>greatest(expected_interval_seconds*3,300)) then 'healthy' else 'stale' end
  where id=p_source_id;
  return inserted_count;
end; $$;
revoke all on function public.operations_ingest_measurement_batch(uuid,uuid,uuid,jsonb) from public, anon, service_role;
grant execute on function public.operations_ingest_measurement_batch(uuid,uuid,uuid,jsonb) to authenticated;

create function public.operations_ingest_connector_batch(
  p_facility_id uuid,p_source_id uuid,p_batch_id uuid,p_records jsonb,p_token_hash text,p_connector_version text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare inserted_count integer; newest timestamptz;
begin
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception using errcode='22023',message='Measurement records must be an array';
  end if;
  if auth.role() is distinct from 'service_role' or not exists (
    select 1 from public.operations_connector_credentials c
    join public.operations_sources s on s.id=c.source_id
    where c.source_id=p_source_id and s.facility_id=p_facility_id
      and c.token_hash=p_token_hash and c.revoked_at is null and c.expires_at>now()
      and not exists(select 1 from jsonb_array_elements(p_records) r where not ((r->>'metric_key')=any(c.metric_allowlist)))
  ) then raise exception using errcode='42501', message='Invalid connector scope or credential'; end if;
  if p_connector_version is null or length(p_connector_version) not between 1 and 80 then
    raise exception using errcode='22023',message='Invalid connector version'; end if;
  inserted_count:=public.operations_ingest_measurement_batch(p_facility_id,p_source_id,p_batch_id,p_records);
  update public.operations_sources set connector_version=p_connector_version where id=p_source_id;
  select latest_event_at into newest from public.operations_source_watermarks where source_id=p_source_id;
  return jsonb_build_object('inserted',inserted_count,'duplicates',jsonb_array_length(p_records)-inserted_count,'latestEventAt',newest);
end; $$;
revoke all on function public.operations_ingest_connector_batch(uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.operations_ingest_connector_batch(uuid,uuid,uuid,jsonb,text,text) to service_role;
