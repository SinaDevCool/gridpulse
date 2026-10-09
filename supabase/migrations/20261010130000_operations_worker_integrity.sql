-- Guard completion with lease generation. Cancellation and reclaimed jobs win.
create function public.update_leased_analytics_job(p_job_id uuid,p_worker_id text,p_attempt integer,p_payload jsonb)
returns setof public.analytics_jobs language plpgsql security definer set search_path=public as $$
begin
  if p_payload->>'status' not in ('running','succeeded','failed') then raise exception 'Invalid worker status'; end if;
  return query update public.analytics_jobs set
    status=p_payload->>'status',result_payload=p_payload->'result_payload',error=p_payload->>'error',
    started_at=coalesce((p_payload->>'started_at')::timestamptz,started_at),
    completed_at=(p_payload->>'completed_at')::timestamptz
  where id=p_job_id and status='running' and lease_owner=p_worker_id and attempt_count=p_attempt
    and lease_expires_at>now() and not cancellation_requested returning *;
end $$;
revoke all on function public.update_leased_analytics_job(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.update_leased_analytics_job(uuid,text,integer,jsonb) to service_role;

create or replace function public.claim_analytics_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.analytics_jobs language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  update public.analytics_jobs set status='failed',error='Worker lease retry limit exhausted',completed_at=now()
  where status='running' and lease_expires_at<now() and attempt_count>=3;
  select id into v_id from public.analytics_jobs where not cancellation_requested and attempt_count<3
    and (status='queued' or (status='running' and lease_expires_at<now()))
    order by created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.analytics_jobs set status='running',started_at=coalesce(started_at,now()),
    attempt_count=attempt_count+1,lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,15),600)),heartbeat_at=now()
    where id=v_id returning *;
end $$;
create or replace function public.heartbeat_analytics_job(p_job_id uuid,p_worker_id text,p_lease_seconds integer default 120)
returns setof public.analytics_jobs language sql security definer set search_path=public as $$
  update public.analytics_jobs set heartbeat_at=now(),
    lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,15),600))
  where id=p_job_id and status='running' and lease_owner=p_worker_id and lease_expires_at>now()
    and not cancellation_requested returning *;
$$;
