-- Persistent source monitoring, notification delivery, decision snapshots, and
-- consent-controlled pilot benchmarks.

create table public.operator_source_checks (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.operator_source_endpoints(id) on delete cascade,
  checked_at timestamptz not null default now(),
  http_status integer,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  content_length bigint check (content_length is null or content_length >= 0),
  etag text,
  last_modified text,
  changed boolean not null default false,
  change_summary jsonb not null default '{}'::jsonb,
  connector_version text not null,
  error text,
  created_at timestamptz not null default now()
);

create index operator_source_checks_endpoint_checked_idx
  on public.operator_source_checks(endpoint_id, checked_at desc);
alter table public.operator_source_checks enable row level security;
grant select on public.operator_source_checks to authenticated;
create policy "evidence reviewers read source checks"
  on public.operator_source_checks for select to authenticated
  using (public.is_operator_evidence_reviewer());

create or replace function public.record_operator_source_check(
  p_endpoint_key text,
  p_source_id text,
  p_http_status integer,
  p_content_sha256 text,
  p_content_length bigint,
  p_etag text,
  p_last_modified text,
  p_connector_version text,
  p_error text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint public.operator_source_endpoints%rowtype;
  prior public.operator_source_checks%rowtype;
  check_id uuid;
  is_changed boolean := false;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select * into endpoint from public.operator_source_endpoints
  where endpoint_key = p_endpoint_key and source_id = p_source_id and active;
  if not found then raise exception 'Active operator endpoint not found.'; end if;
  select * into prior from public.operator_source_checks
  where endpoint_id = endpoint.id and error is null
  order by checked_at desc limit 1;
  is_changed := prior.id is not null
    and p_error is null
    and prior.content_sha256 is distinct from p_content_sha256;

  insert into public.operator_source_checks (
    endpoint_id,http_status,content_sha256,content_length,etag,last_modified,
    changed,change_summary,connector_version,error
  ) values (
    endpoint.id,p_http_status,p_content_sha256,p_content_length,p_etag,p_last_modified,
    is_changed,
    jsonb_strip_nulls(jsonb_build_object(
      'previous_sha256', prior.content_sha256,
      'current_sha256', p_content_sha256,
      'previous_length', prior.content_length,
      'current_length', p_content_length
    )),
    p_connector_version,p_error
  ) returning id into check_id;

  update public.operator_source_endpoints
  set last_checked_at = now(),
      last_changed_at = case when is_changed then now() else last_changed_at end,
      metadata = metadata || jsonb_build_object(
        'last_health_status', case when p_error is null then 'healthy' else 'error' end,
        'last_check_id', check_id
      )
  where id = endpoint.id;
  return check_id;
end;
$$;

revoke all on function public.record_operator_source_check(
  text,text,integer,text,bigint,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.record_operator_source_check(
  text,text,integer,text,bigint,text,text,text,text
) to service_role;

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid references public.candidate_sites(id) on delete cascade,
  alert_key text not null,
  notification_type text not null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  detail text not null,
  action_path text,
  due_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, alert_key)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.user_notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app','email')),
  status text not null default 'pending'
    check (status in ('pending','suppressed','sent','failed')),
  recipient text,
  provider_message_id text,
  attempted_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique(notification_id, channel)
);

alter table public.user_notifications enable row level security;
alter table public.notification_deliveries enable row level security;
grant select, update on public.user_notifications to authenticated;
grant select on public.notification_deliveries to authenticated;
create policy "users read own notifications"
  on public.user_notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users update own notification state"
  on public.user_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users read own notification deliveries"
  on public.notification_deliveries for select to authenticated
  using (exists (
    select 1 from public.user_notifications n
    where n.id = notification_id and n.user_id = (select auth.uid())
  ));
create trigger user_notifications_set_updated_at before update on public.user_notifications
for each row execute function public.set_updated_at();

create or replace function public.refresh_my_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.user_notifications (
    user_id,site_id,alert_key,notification_type,severity,title,detail,action_path,due_at
  )
  select (select auth.uid()), a.site_id, a.alert_key, a.alert_type, a.severity,
         a.title, a.detail, a.action_path, a.due_at
  from public.connection_decision_alerts() a
  on conflict (user_id, alert_key) do update set
    severity = excluded.severity,
    title = excluded.title,
    detail = excluded.detail,
    action_path = excluded.action_path,
    due_at = excluded.due_at,
    dismissed_at = null,
    updated_at = now();
  get diagnostics affected = row_count;

  insert into public.notification_deliveries (notification_id,channel,status)
  select n.id,'in_app','sent'
  from public.user_notifications n
  where n.user_id = (select auth.uid())
  on conflict (notification_id,channel) do nothing;

  insert into public.notification_deliveries (notification_id,channel,status,recipient)
  select n.id,'email','pending',coalesce((select auth.jwt()->>'email'),'')
  from public.user_notifications n
  where n.user_id = (select auth.uid())
    and n.severity in ('warning','critical')
    and n.dismissed_at is null
  on conflict (notification_id,channel) do nothing;
  return affected;
end;
$$;

revoke all on function public.refresh_my_notifications() from public, anon;
grant execute on function public.refresh_my_notifications() to authenticated;

create table public.project_decision_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  snapshot_type text not null check (snapshot_type in ('site_selection','operator_submission','operator_response','final_outcome')),
  version integer not null,
  decision_label text not null,
  decision_rationale text not null,
  state jsonb not null,
  state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(site_id, version),
  unique(site_id, state_hash)
);

alter table public.project_decision_snapshots enable row level security;
grant select, insert on public.project_decision_snapshots to authenticated;
create policy "participants read project decision snapshots"
  on public.project_decision_snapshots for select to authenticated
  using (public.can_read_assessment(site_id));
create policy "editors create project decision snapshots"
  on public.project_decision_snapshots for insert to authenticated
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));

create or replace function public.capture_project_decision_snapshot(
  p_site_id uuid,
  p_snapshot_type text,
  p_decision_label text,
  p_decision_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_state jsonb;
  snapshot_hash text;
  next_version integer;
  snapshot_id uuid;
begin
  if not public.can_edit_assessment(p_site_id) then raise exception 'Editor access required.'; end if;
  if p_snapshot_type not in ('site_selection','operator_submission','operator_response','final_outcome')
    then raise exception 'Invalid snapshot type.'; end if;
  if char_length(trim(p_decision_rationale)) < 10 then
    raise exception 'Decision rationale must contain at least 10 characters.'; end if;

  select jsonb_build_object(
    'schema','gridpulse.project-decision-snapshot.v1',
    'captured_at',now(),
    'project',to_jsonb(s),
    'decision_intelligence',coalesce((
      select to_jsonb(p) from public.connection_decision_portfolio() p where p.site_id = s.id
    ),'{}'::jsonb),
    'latest_engagement',coalesce((
      select to_jsonb(e) from public.operator_engagements e
      where e.site_id = s.id order by e.updated_at desc limit 1
    ),'{}'::jsonb),
    'latest_operator_decision',coalesce((
      select to_jsonb(d) from public.operator_decisions d
      where d.site_id = s.id order by d.created_at desc limit 1
    ),'{}'::jsonb)
  ) into snapshot_state
  from public.candidate_sites s where s.id = p_site_id;
  if snapshot_state is null then raise exception 'Project not found.'; end if;
  snapshot_hash := encode(extensions.digest(snapshot_state::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text, 13));
  select coalesce(max(version),0)+1 into next_version
  from public.project_decision_snapshots where site_id = p_site_id;
  insert into public.project_decision_snapshots (
    site_id,user_id,snapshot_type,version,decision_label,decision_rationale,state,state_hash
  ) values (
    p_site_id,(select auth.uid()),p_snapshot_type,next_version,
    trim(p_decision_label),trim(p_decision_rationale),snapshot_state,snapshot_hash
  ) returning id into snapshot_id;
  return snapshot_id;
end;
$$;

revoke all on function public.capture_project_decision_snapshot(uuid,text,text,text)
  from public, anon;
grant execute on function public.capture_project_decision_snapshot(uuid,text,text,text)
  to authenticated;

create or replace function public.operator_pilot_benchmarks()
returns table (
  operator_name text,
  completed_pilots integer,
  response_time_days numeric,
  clarification_rounds numeric,
  reinforcement_rate numeric,
  indicated_lead_time_days numeric,
  cost_per_requested_mw_eur numeric,
  customer_confirmed_observations integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select
      coalesce(s.responsible_operator_name,s.likely_network_operator,'Unconfirmed') as operator_name,
      p.id as pilot_id, p.requested_import_mw, p.target_energization_date,
      o.clarification_rounds_count, o.customer_confirmed,
      e.submitted_at,e.response_received_at,e.reinforcement_required,
      e.indicated_connection_date,e.estimated_connection_cost_eur
    from public.pilot_engagements p
    join public.candidate_sites s on s.id = p.site_id
    join public.pilot_outcome_observations o on o.engagement_id = p.id and o.stage = 'final'
    left join lateral (
      select engagement.* from public.operator_engagements engagement
      where engagement.site_id = p.site_id
      order by engagement.updated_at desc limit 1
    ) e on true
    where p.status = 'completed'
      and p.anonymized_case_study_allowed
      and o.customer_confirmed
  )
  select
    operator_name,
    count(distinct pilot_id)::integer,
    round(avg(extract(epoch from (response_received_at-submitted_at))/86400)::numeric,1),
    round(avg(clarification_rounds_count)::numeric,1),
    round(100 * avg(case when reinforcement_required then 1 else 0 end)::numeric,1),
    round(avg(indicated_connection_date-current_date)::numeric,0),
    round(avg(estimated_connection_cost_eur/nullif(requested_import_mw,0))::numeric,0),
    count(*)::integer
  from eligible
  group by operator_name
  having count(*) >= 1
  order by count(distinct pilot_id) desc, operator_name;
$$;

revoke all on function public.operator_pilot_benchmarks() from public, anon;
grant execute on function public.operator_pilot_benchmarks() to authenticated;

create or replace function public.management_portfolio_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with projects as (select * from public.connection_decision_portfolio()),
  engagements as (
    select e.* from public.operator_engagements e where public.can_read_assessment(e.site_id)
  )
  select jsonb_build_object(
    'project_count',(select count(*) from projects),
    'requested_import_mw',(select coalesce(sum(requested_import_mw),0) from projects),
    'indicated_import_mw',(select coalesce(sum(indicated_import_mw),0) from projects),
    'estimated_capital_eur',(select coalesce(sum(estimated_connection_cost_eur),0) from projects),
    'blocked_by_evidence',(select count(*) from projects where evidence_score < 65),
    'awaiting_operator',(select count(*) from engagements where status in ('submitted','acknowledged','under_review','information_requested')),
    'offers_requiring_decision',(select count(*) from engagements where status in ('offer_received','reserved')),
    'operator_confirmed',(select count(*) from projects where evidence_state = 'operator_confirmed')
  );
$$;

revoke all on function public.management_portfolio_summary() from public, anon;
grant execute on function public.management_portfolio_summary() to authenticated;

create table public.operator_onboarding_register (
  id uuid primary key default gen_random_uuid(),
  operator_name text not null unique,
  priority integer not null check (priority between 1 and 5),
  geographic_value text not null,
  source_discovery_status text not null
    check (source_discovery_status in ('planned','discovered','rights_review','connector_ready','active','blocked')),
  candidate_sources jsonb not null default '[]'::jsonb,
  rights_status text not null
    check (rights_status in ('not_reviewed','metadata_only','permission_requested','permitted','blocked')),
  next_action text not null,
  updated_at timestamptz not null default now()
);
alter table public.operator_onboarding_register enable row level security;
grant select on public.operator_onboarding_register to authenticated;
create policy "authenticated users read operator onboarding register"
  on public.operator_onboarding_register for select to authenticated using (true);

insert into public.operator_onboarding_register (
  operator_name,priority,geographic_value,source_discovery_status,candidate_sources,
  rights_status,next_action
) values
  ('50Hertz Transmission GmbH',1,'Eastern Germany and large-load transmission enquiries','rights_review',
   '[{"type":"capacity_map","url":"https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss"}]'::jsonb,
   'permission_requested','Send the prepared reuse-permission request after recipient confirmation.'),
  ('E.DIS Netz GmbH',1,'Brandenburg distribution context','active',
   '[{"type":"connection_process","url":"https://www.e-dis-netz.de/"},{"type":"generation_monitor","url":"https://netzanschlussmonitor.e-dis-netz.de/"}]'::jsonb,
   'metadata_only','Collect real demand-connection outcomes from consented pilots.'),
  ('MITNETZ STROM',2,'Eastern Germany distribution expansion','discovered',
   '[{"type":"connection_portal","url":"https://www.mitnetz-strom.de/online-services/netzanschluss"}]'::jsonb,
   'not_reviewed','Complete source and reuse-rights review.'),
  ('Stromnetz Berlin GmbH',2,'Berlin large-load and data-centre demand','discovered',
   '[{"type":"connection_page","url":"https://www.stromnetz.berlin/anschliessen/"}]'::jsonb,
   'not_reviewed','Complete source and reuse-rights review.')
on conflict (operator_name) do update set
  priority=excluded.priority,candidate_sources=excluded.candidate_sources,
  next_action=excluded.next_action,updated_at=now();

comment on function public.operator_pilot_benchmarks() is
  'Aggregates only completed pilots with anonymised-case permission and customer-confirmed final observations.';
