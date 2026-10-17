alter table public.analytics_jobs add column execution_manifest jsonb not null default '{}'::jsonb;

create function public.operations_guard_job_input() returns trigger language plpgsql as $$
begin
  if (new.owner_id,new.job_type,new.input_payload,new.input_fingerprint,new.execution_manifest)
    is distinct from (old.owner_id,old.job_type,old.input_payload,old.input_fingerprint,old.execution_manifest) then
    raise exception using errcode='22023',message='Job inputs and execution identity are immutable';
  end if;
  return new;
end $$;
create trigger operations_job_input_immutable before update on public.analytics_jobs
for each row execute function public.operations_guard_job_input();

create or replace function public.create_analytics_job_once(p_job jsonb) returns setof public.analytics_jobs
language plpgsql security definer set search_path=public as $$
declare existing_id uuid; fingerprint text:=p_job->>'input_fingerprint'; owner uuid:=(p_job->>'owner_id')::uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Trusted job service required'; end if;
  -- Owner-wide lock also serializes admission for different job fingerprints.
  perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
  if fingerprint is not null then
    if fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid input fingerprint'; end if;
    select id into existing_id from public.analytics_jobs where owner_id=owner
      and job_type=p_job->>'job_type' and input_fingerprint=fingerprint and status not in ('failed','cancelled')
      order by created_at desc limit 1;
    if existing_id is not null then return query select * from public.analytics_jobs where id=existing_id; return; end if;
  end if;
  if (select count(*) from public.analytics_jobs where owner_id=owner and status in ('queued','running'))>=20 then
    raise exception using errcode='53300',message='Owner active job limit reached'; end if;
  if octet_length(coalesce(p_job->'input_payload','{}')::text)>8388608 then
    raise exception using errcode='54000',message='Job payload exceeds safe bound'; end if;
  return query insert into public.analytics_jobs(id,owner_id,job_type,input_payload,input_fingerprint,execution_manifest)
  values((p_job->>'id')::uuid,owner,p_job->>'job_type',coalesce(p_job->'input_payload','{}'::jsonb),fingerprint,coalesce(p_job->'execution_manifest','{}'::jsonb))
  returning *;
end $$;
revoke all on function public.create_analytics_job_once(jsonb) from public,anon,authenticated;
grant execute on function public.create_analytics_job_once(jsonb) to service_role;
