-- Public visitors reuse the job store and solver, but never inherit authenticated privileges.
begin;

create role gridpulse_public_visitor nologin nosuperuser nocreatedb nocreaterole inherit nobypassrls;
grant anon to gridpulse_public_visitor;
grant gridpulse_public_visitor to authenticator;
grant usage on schema public, auth to gridpulse_public_visitor;

alter table public.analytics_jobs add column access_scope text not null default 'private'
  check (access_scope in ('private','public'));
create index analytics_jobs_public_admission_idx on public.analytics_jobs(created_at,owner_id)
  where access_scope='public';
grant select on public.analytics_jobs to gridpulse_public_visitor;
create policy analytics_jobs_public_owner_select on public.analytics_jobs
  for select to gridpulse_public_visitor
  using (access_scope='public' and owner_id=auth.uid());

-- Runs only in Supabase Auth, before signing tokens. Never trust user_metadata for role selection.
create function public.gridpulse_public_access_token(event jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare anonymous_user boolean; claims jsonb;
begin
  select is_anonymous into anonymous_user from auth.users where id=(event->>'user_id')::uuid;
  if anonymous_user is null then raise exception 'Token subject does not exist'; end if;
  claims:=event->'claims';
  if jsonb_typeof(claims) is distinct from 'object' then raise exception 'Token claims required'; end if;
  if anonymous_user then
    claims:=jsonb_set(claims,'{role}','"gridpulse_public_visitor"'::jsonb);
    claims:=jsonb_set(claims,'{is_anonymous}','true'::jsonb);
  elsif claims->>'role'='gridpulse_public_visitor' then
    claims:=jsonb_set(claims,'{role}','"authenticated"'::jsonb);
    claims:=jsonb_set(claims,'{is_anonymous}','false'::jsonb);
  end if;
  return jsonb_set(event,'{claims}',claims);
end $$;
revoke all on function public.gridpulse_public_access_token(jsonb) from public,anon,authenticated,gridpulse_public_visitor;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.gridpulse_public_access_token(jsonb) to supabase_auth_admin;

-- One claim implementation, now with explicit access scope. Legacy callers remain private.
create function public.claim_analytics_job(
  p_worker_id text,p_lease_seconds integer,p_job_types text[],p_access_scope text
) returns setof public.analytics_jobs
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
  if p_access_scope is null or p_access_scope not in ('private','public') then
    raise exception using errcode='22023',message='Invalid job access scope';
  end if;
  if p_job_types is not null and (
    coalesce(array_ndims(p_job_types),0)<>1 or cardinality(p_job_types) not between 1 and 20
    or exists(select 1 from unnest(p_job_types) t where t is null or btrim(t)='')
  ) then raise exception using errcode='22023',message='Invalid analytics job-type scope'; end if;
  if p_access_scope='public' then
    if p_job_types is distinct from array['facility_plan']::text[] then
      raise exception using errcode='22023',message='Public worker only supports facility plans';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('gridpulse-public-milp-capacity',0));
    if exists(select 1 from public.analytics_jobs where access_scope='public'
      and status='running' and lease_expires_at>now()) then return; end if;
  end if;
  update public.analytics_jobs set status='failed',error='Worker lease retry limit exhausted',completed_at=now()
    where access_scope=p_access_scope and status='running' and lease_expires_at<now() and attempt_count>=3
    and (p_job_types is null or job_type=any(p_job_types));
  select id into v_id from public.analytics_jobs
    where access_scope=p_access_scope and not cancellation_requested and attempt_count<3
    and (p_job_types is null or job_type=any(p_job_types))
    and (status='queued' or (status='running' and lease_expires_at<now()))
    order by created_at,id for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.analytics_jobs set status='running',started_at=coalesce(started_at,now()),
    attempt_count=attempt_count+1,lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,15),600)),heartbeat_at=now()
    where id=v_id returning *;
end $$;
create or replace function public.claim_analytics_job(p_worker_id text,p_lease_seconds integer,p_job_types text[])
returns setof public.analytics_jobs language sql security definer set search_path=pg_catalog,public as $$
  select * from public.claim_analytics_job(p_worker_id,p_lease_seconds,p_job_types,'private');
$$;
revoke all on function public.claim_analytics_job(text,integer,text[],text) from public,anon,authenticated,gridpulse_public_visitor;
grant execute on function public.claim_analytics_job(text,integer,text[],text) to service_role;

-- Admission is durable and atomic across processes/restarts. Limits cannot be supplied by clients.
create function public.create_public_facility_job(p_job jsonb) returns setof public.analytics_jobs
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_owner uuid:=(p_job->>'owner_id')::uuid; v_fingerprint text:=p_job->>'input_fingerprint'; v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode='42501',message='Trusted job service required';
  end if;
  if p_job->>'job_type' is distinct from 'facility_plan' or v_fingerprint is null
    or v_fingerprint !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_job->'input_payload') is distinct from 'object'
    or octet_length((p_job->'input_payload')::text)>1000000 then
    raise exception using errcode='22023',message='Invalid public facility request';
  end if;
  if not exists(select 1 from auth.users where id=v_owner and is_anonymous=true) then
    raise exception using errcode='42501',message='Anonymous visitor identity required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gridpulse-public-milp-capacity',0));
  -- A retry returns the same receipt, including terminal outcomes; never silently re-solve.
  select id into v_id from public.analytics_jobs where owner_id=v_owner and job_type='facility_plan'
    and access_scope='public' and input_fingerprint=v_fingerprint order by created_at desc limit 1;
  if v_id is not null then return query select * from public.analytics_jobs where id=v_id; return; end if;
  if exists(select 1 from public.analytics_jobs where access_scope='public' and owner_id=v_owner
    and status in ('queued','running'))
    or (select count(*) from public.analytics_jobs where access_scope='public' and status in ('queued','running'))>=2
    or (select count(*) from public.analytics_jobs where access_scope='public' and owner_id=v_owner
      and created_at>now()-interval '1 hour')>=3
    or (select count(*) from public.analytics_jobs where access_scope='public'
      and created_at>now()-interval '1 hour')>=20 then
    raise sqlstate 'PT429' using message='Public MILP capacity or quota reached; retry later';
  end if;
  return query insert into public.analytics_jobs(id,owner_id,job_type,input_payload,input_fingerprint,access_scope)
    values((p_job->>'id')::uuid,v_owner,'facility_plan',p_job->'input_payload',v_fingerprint,'public') returning *;
end $$;
revoke all on function public.create_public_facility_job(jsonb) from public,anon,authenticated,gridpulse_public_visitor;
grant execute on function public.create_public_facility_job(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
