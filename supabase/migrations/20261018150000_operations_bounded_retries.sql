alter table public.analytics_jobs add column retry_after_at timestamptz;
create index analytics_retry_lookup_idx on public.analytics_jobs(status,retry_after_at,created_at);

create function public.defer_analytics_job(p_job_id uuid,p_worker_id text,p_attempt integer)
returns setof public.analytics_jobs language sql security definer set search_path=public as $$
  update public.analytics_jobs set
    status=case when attempt_count>=3 then 'failed' else 'queued' end,
    error=case when attempt_count>=3 then 'Transient dependency failure; retry limit exhausted' else 'Transient dependency failure; retry scheduled' end,
    retry_after_at=case when attempt_count>=3 then null else now()+make_interval(secs=>5*power(2,attempt_count-1)::integer) end,
    completed_at=case when attempt_count>=3 then now() else null end,
    lease_owner=null,lease_expires_at=null
  where id=p_job_id and status='running' and lease_owner=p_worker_id and attempt_count=p_attempt
    and lease_expires_at>now() and not cancellation_requested returning *;
$$;
revoke all on function public.defer_analytics_job(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.defer_analytics_job(uuid,text,integer) to service_role;

create or replace function public.claim_analytics_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.analytics_jobs language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  update public.analytics_jobs set status='failed',error='Worker lease retry limit exhausted',completed_at=now()
    where status='running' and lease_expires_at<now() and attempt_count>=3;
  select id into v_id from public.analytics_jobs where not cancellation_requested and attempt_count<3
    and (retry_after_at is null or retry_after_at<=now())
    and (status='queued' or (status='running' and lease_expires_at<now()))
    order by created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.analytics_jobs set status='running',started_at=coalesce(started_at,now()),
    attempt_count=attempt_count+1,lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,15),600)),heartbeat_at=now()
    where id=v_id returning *;
end $$;
