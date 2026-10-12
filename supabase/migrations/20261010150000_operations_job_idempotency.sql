alter table public.analytics_jobs add column if not exists input_fingerprint text;

-- Advisory lock prevents simultaneous submissions from creating duplicates.
-- Failed/cancelled executions may be resubmitted as new versions.
create function public.create_analytics_job_once(p_job jsonb) returns setof public.analytics_jobs
language plpgsql security definer set search_path=public as $$
declare existing_id uuid; fingerprint text:=p_job->>'input_fingerprint';
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Trusted job service required'; end if;
  if fingerprint is not null then
    if fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid input fingerprint'; end if;
    perform pg_advisory_xact_lock(hashtextextended((p_job->>'owner_id')||':'||(p_job->>'job_type')||':'||fingerprint,0));
    select id into existing_id from public.analytics_jobs where owner_id=(p_job->>'owner_id')::uuid
      and job_type=p_job->>'job_type' and input_fingerprint=fingerprint and status not in ('failed','cancelled')
      order by created_at desc limit 1;
    if existing_id is not null then return query select * from public.analytics_jobs where id=existing_id; return; end if;
  end if;
  return query insert into public.analytics_jobs(id,owner_id,job_type,input_payload,input_fingerprint)
  values((p_job->>'id')::uuid,(p_job->>'owner_id')::uuid,p_job->>'job_type',coalesce(p_job->'input_payload','{}'::jsonb),fingerprint)
  returning *;
end $$;
revoke all on function public.create_analytics_job_once(jsonb) from public,anon,authenticated;
grant execute on function public.create_analytics_job_once(jsonb) to service_role;
