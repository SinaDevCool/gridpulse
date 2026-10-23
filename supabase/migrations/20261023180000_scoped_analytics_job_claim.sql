-- Add a scope to the existing queue, not a second queue or table.
-- The two-argument signature remains compatible with deployed workers.
begin;

create or replace function public.claim_analytics_job(
  p_worker_id text, p_lease_seconds integer, p_job_types text[]
) returns setof public.analytics_jobs
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
  -- NULL is reserved for the legacy unscoped signature. Empty/malformed scopes
  -- must never accidentally turn an Operations worker into a global worker.
  if p_job_types is not null and (
    coalesce(array_ndims(p_job_types), 0) <> 1
    or cardinality(p_job_types) not between 1 and 20
    or exists (select 1 from unnest(p_job_types) t where t is null or btrim(t) = '')
  ) then
    raise exception using errcode = '22023', message = 'Invalid analytics job-type scope';
  end if;

  -- Scope retry-exhaustion writes too: unrelated jobs remain untouched.
  update public.analytics_jobs set
    status = 'failed', error = 'Worker lease retry limit exhausted', completed_at = now()
  where status = 'running' and lease_expires_at < now() and attempt_count >= 3
    and (p_job_types is null or job_type = any(p_job_types));

  select id into v_id from public.analytics_jobs
  where not cancellation_requested and attempt_count < 3
    and (p_job_types is null or job_type = any(p_job_types))
    and (status = 'queued' or (status = 'running' and lease_expires_at < now()))
  order by created_at, id for update skip locked limit 1;
  if v_id is null then return; end if;

  return query update public.analytics_jobs set
    status = 'running', started_at = coalesce(started_at, now()),
    attempt_count = attempt_count + 1, lease_owner = p_worker_id,
    lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 15), 600)),
    heartbeat_at = now()
  where id = v_id returning *;
end $$;

-- One implementation owns claiming and retry exhaustion for both signatures.
create or replace function public.claim_analytics_job(
  p_worker_id text, p_lease_seconds integer default 120
) returns setof public.analytics_jobs
language sql security definer set search_path = pg_catalog, public as $$
  select * from public.claim_analytics_job(p_worker_id, p_lease_seconds, null::text[]);
$$;

revoke all on function public.claim_analytics_job(text, integer, text[]) from public, anon, authenticated;
revoke all on function public.claim_analytics_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_analytics_job(text, integer, text[]) to service_role;
grant execute on function public.claim_analytics_job(text, integer) to service_role;

notify pgrst, 'reload schema';
commit;
