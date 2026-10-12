-- Canonical evidence origin and restart-safe analytics execution.
alter table public.analytics_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists checkpoint_payload jsonb not null default '{}'::jsonb,
  add column if not exists cancellation_requested boolean not null default false;

alter table public.analytics_jobs drop constraint if exists analytics_jobs_job_type_check;
alter table public.analytics_jobs add constraint analytics_jobs_job_type_check check (job_type in (
  'operator_source_health','profile_validation','corridor_ranking','activation_scenario',
  'network_simulation','reference_topology','flexibility_optimization','synthetic_capacity',
  'release_b_network','c1_network_study','c2_hourly_capacity','c3_security_flexibility',
  'c4_reconciliation','p0_p4_permutation','release3_shadow_validation','graph_guided_study'
));

create index if not exists analytics_jobs_claim_idx
  on public.analytics_jobs (created_at, lease_expires_at)
  where status in ('queued', 'running') and cancellation_requested = false;

create or replace function public.claim_analytics_job(
  p_worker_id text,
  p_lease_seconds integer default 120
) returns setof public.analytics_jobs
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.analytics_jobs
  where cancellation_requested = false
    and (status = 'queued' or (status = 'running' and lease_expires_at < now()))
  order by created_at
  for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.analytics_jobs set
    status = 'running',
    started_at = coalesce(started_at, now()),
    attempt_count = attempt_count + 1,
    lease_owner = p_worker_id,
    lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 15)),
    heartbeat_at = now()
  where id = v_id returning *;
end $$;

create or replace function public.heartbeat_analytics_job(
  p_job_id uuid, p_worker_id text, p_lease_seconds integer default 120
) returns setof public.analytics_jobs
language sql security definer set search_path = public as $$
  update public.analytics_jobs set
    heartbeat_at = now(),
    lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 15))
  where id = p_job_id and status = 'running' and lease_owner = p_worker_id
    and cancellation_requested = false returning *;
$$;

create or replace function public.checkpoint_analytics_job(
  p_job_id uuid, p_worker_id text, p_payload jsonb
) returns setof public.analytics_jobs
language sql security definer set search_path = public as $$
  update public.analytics_jobs set checkpoint_payload = coalesce(p_payload, '{}'::jsonb)
  where id = p_job_id and status = 'running' and lease_owner = p_worker_id
    and cancellation_requested = false returning *;
$$;

create or replace function public.cancel_analytics_job(p_job_id uuid, p_owner_id uuid)
returns setof public.analytics_jobs
language sql security definer set search_path = public as $$
  update public.analytics_jobs set
    cancellation_requested = true,
    status = case when status in ('succeeded','failed','cancelled') then status else 'cancelled' end,
    completed_at = case when status in ('succeeded','failed','cancelled') then completed_at else now() end,
    lease_owner = null,
    lease_expires_at = null
  where id = p_job_id and owner_id = p_owner_id returning *;
$$;

revoke all on function public.claim_analytics_job(text, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_analytics_job(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.checkpoint_analytics_job(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_analytics_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_analytics_job(text, integer) to service_role;
grant execute on function public.heartbeat_analytics_job(uuid, text, integer) to service_role;
grant execute on function public.checkpoint_analytics_job(uuid, text, jsonb) to service_role;
grant execute on function public.cancel_analytics_job(uuid, uuid) to service_role;

alter table if exists public.pilot_datasets
  add column if not exists evidence_origin text,
  add column if not exists publisher text,
  add column if not exists retrieved_at timestamptz,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists parser_version text,
  add column if not exists derivation_version text;

update public.pilot_datasets set evidence_origin = case evidence_class
  when 'official_public' then 'official_open'
  when 'open_mapping' then 'official_open'
  when 'customer_supplied' then 'customer_declared'
  when 'operator_supplied' then 'operator_supplied'
  when 'synthetic' then 'synthetic_fixture'
  else 'derived' end
where evidence_origin is null;

alter table if exists public.pilot_datasets
  alter column evidence_origin set not null;

alter table if exists public.pilot_datasets
  drop constraint if exists pilot_datasets_evidence_origin_check;
alter table if exists public.pilot_datasets
  add constraint pilot_datasets_evidence_origin_check check (evidence_origin in (
    'official_open','open_benchmark','operator_supplied','customer_declared',
    'synthetic_fixture','derived'
  ));

create or replace function public.enforce_pilot_evidence_origin()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_synthetic <> (new.evidence_origin = 'synthetic_fixture') then
    raise exception 'is_synthetic must match evidence_origin=synthetic_fixture';
  end if;
  return new;
end $$;

drop trigger if exists pilot_dataset_evidence_origin_guard on public.pilot_datasets;
create trigger pilot_dataset_evidence_origin_guard before insert or update
on public.pilot_datasets for each row execute function public.enforce_pilot_evidence_origin();
