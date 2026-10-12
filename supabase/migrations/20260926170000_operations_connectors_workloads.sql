-- Read-only operational connector and workload foundation.
-- Numeric telemetry remains normalized in operations_measurements.

create table if not exists public.operations_connector_configs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_id uuid not null references public.operations_sources(id) on delete cascade,
  connector_type text not null check (connector_type in ('prometheus_dcgm','kueue','slurm','openems','sunspec','modbus','opcua','file')),
  endpoint_host text,
  secret_reference text,
  enabled boolean not null default false,
  poll_interval_seconds integer check (poll_interval_seconds is null or poll_interval_seconds between 5 and 86400),
  metric_allowlist text[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id),
  check (secret_reference is null or secret_reference !~ '(password|token|secret)=')
);

create table if not exists public.operations_source_watermarks (
  source_id uuid primary key references public.operations_sources(id) on delete cascade,
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  latest_event_at timestamptz,
  latest_received_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error_code text,
  updated_at timestamptz not null default now()
);

create table if not exists public.operations_workloads (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_id uuid not null references public.operations_sources(id) on delete cascade,
  source_workload_id text not null,
  name text not null,
  workload_class text not null check (workload_class in ('training','inference','batch','critical')),
  status text not null check (status in ('running','queued','held','completed')),
  priority integer not null default 0,
  submitted_at timestamptz not null,
  earliest_start timestamptz not null,
  deadline timestamptz not null,
  expected_duration_minutes numeric not null check (expected_duration_minutes > 0),
  requested_gpu_count integer not null check (requested_gpu_count > 0),
  minimum_gpu_count integer not null check (minimum_gpu_count > 0 and minimum_gpu_count <= requested_gpu_count),
  gpu_model text,
  checkpointable boolean not null default false,
  preemptible boolean not null default false,
  geographically_portable boolean not null default false,
  maximum_delay_minutes integer not null default 0 check (maximum_delay_minutes >= 0),
  evidence_class text not null check (evidence_class in ('measured','customer_declared','reference')),
  updated_at timestamptz not null default now(),
  unique (source_id, source_workload_id),
  check (deadline > earliest_start)
);

create table if not exists public.operations_workload_events (
  id bigint generated always as identity primary key,
  workload_id uuid not null references public.operations_workloads(id) on delete cascade,
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  event_at timestamptz not null,
  event_type text not null check (event_type in ('submitted','admitted','started','held','resumed','completed','failed','updated')),
  payload jsonb not null default '{}'::jsonb,
  source_record_id text not null,
  unique (workload_id, source_record_id)
);

create table if not exists public.operations_asset_bindings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  workload_id uuid references public.operations_workloads(id) on delete cascade,
  source_id uuid not null references public.operations_sources(id) on delete cascade,
  asset_id text not null,
  asset_kind text not null check (asset_kind in ('gpu','node','pod','job','battery','meter')),
  valid_from timestamptz not null,
  valid_to timestamptz,
  evidence_class text not null check (evidence_class in ('measured','customer_declared','calculated')),
  unique (source_id, asset_id, valid_from),
  check (valid_to is null or valid_to >= valid_from)
);

create index if not exists operations_workloads_lookup_idx on public.operations_workloads(facility_id, status, deadline);
create index if not exists operations_workload_events_lookup_idx on public.operations_workload_events(facility_id, event_at desc);
create index if not exists operations_asset_bindings_lookup_idx on public.operations_asset_bindings(facility_id, asset_id, valid_from desc);

alter table public.operations_connector_configs enable row level security;
alter table public.operations_source_watermarks enable row level security;
alter table public.operations_workloads enable row level security;
alter table public.operations_workload_events enable row level security;
alter table public.operations_asset_bindings enable row level security;

create policy "owners manage connector configs" on public.operations_connector_configs for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners read source watermarks" on public.operations_source_watermarks for select to authenticated using (owner_id=auth.uid());
create policy "owners read workloads" on public.operations_workloads for select to authenticated using (owner_id=auth.uid());
create policy "owners read workload events" on public.operations_workload_events for select to authenticated using (owner_id=auth.uid());
create policy "owners read asset bindings" on public.operations_asset_bindings for select to authenticated using (owner_id=auth.uid());

grant select, insert, update, delete on public.operations_connector_configs to authenticated;
grant select on public.operations_source_watermarks, public.operations_workloads, public.operations_workload_events, public.operations_asset_bindings to authenticated;

comment on table public.operations_connector_configs is 'Read-only connector metadata. Secrets are stored externally and referenced, never persisted here.';
comment on table public.operations_workloads is 'Observed or customer-declared scheduler workloads. Synthetic scenario workloads are prohibited.';
comment on table public.operations_asset_bindings is 'Time-bounded attribution of GPU, pod, node and scheduler identities.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('operations-raw', 'operations-raw', false, 52428800, array['text/csv','application/json','application/gzip'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy "owners read raw operations evidence" on storage.objects for select to authenticated
using (bucket_id='operations-raw' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "owners upload raw operations evidence" on storage.objects for insert to authenticated
with check (bucket_id='operations-raw' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.operations_ingest_measurement_batch(
  p_facility_id uuid,
  p_source_id uuid,
  p_batch_id uuid,
  p_records jsonb
) returns integer
language plpgsql security definer set search_path=public
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.operations_sources s
    where s.id=p_source_id and s.facility_id=p_facility_id and s.owner_id=auth.uid()
  ) then
    raise exception 'Operations source is not owned by the caller';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 100000 then
    raise exception 'Invalid operations measurement batch';
  end if;
  insert into public.operations_measurements (
    facility_id, source_id, metric_key, asset_id, event_at, interval_seconds,
    value, unit, value_kind, quality, source_record_id, ingestion_batch_id
  )
  select p_facility_id, p_source_id, record.metric_key, coalesce(record.asset_id,'facility'),
    record.event_at, record.interval_seconds, record.value, record.unit, 'observed',
    coalesce(record.quality,'accepted'), record.source_record_id, p_batch_id
  from jsonb_to_recordset(p_records) as record(
    metric_key text, asset_id text, event_at timestamptz, interval_seconds integer,
    value numeric, unit text, quality text, source_record_id text
  )
  on conflict (source_id, source_record_id, metric_key, asset_id) do nothing;
  get diagnostics inserted_count = row_count;
  update public.operations_sources set
    health='healthy', last_received_at=now()
  where id=p_source_id;
  insert into public.operations_source_watermarks (
    source_id, facility_id, owner_id, latest_event_at, latest_received_at,
    consecutive_failures, last_error_code
  ) values (
    p_source_id, p_facility_id, auth.uid(),
    (select max((item->>'event_at')::timestamptz) from jsonb_array_elements(p_records) item),
    now(), 0, null
  ) on conflict (source_id) do update set
    latest_event_at=excluded.latest_event_at,
    latest_received_at=excluded.latest_received_at,
    consecutive_failures=0,
    last_error_code=null,
    updated_at=now();
  return inserted_count;
end;
$$;

revoke all on function public.operations_ingest_measurement_batch(uuid,uuid,uuid,jsonb) from public, anon;
grant execute on function public.operations_ingest_measurement_batch(uuid,uuid,uuid,jsonb) to authenticated;
