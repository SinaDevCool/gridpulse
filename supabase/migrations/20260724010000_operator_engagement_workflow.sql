-- Close the loop from public evidence review to project-specific operator engagement.

create or replace function public.is_operator_evidence_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.candidate_sites s
    where s.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.assessment_collaborators c
    where c.accepted_by = (select auth.uid())
      and c.role in ('grid_expert','workspace_admin')
  );
$$;

revoke all on function public.is_operator_evidence_reviewer() from public, anon;
grant execute on function public.is_operator_evidence_reviewer() to authenticated;

create policy "evidence reviewers read proposed operator node matches"
  on public.operator_node_evidence_matches for select to authenticated
  using (public.is_operator_evidence_reviewer());

create or replace function public.review_operator_node_evidence_match(
  p_match_id uuid,
  p_decision text,
  p_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewed_match public.operator_node_evidence_matches%rowtype;
begin
  if not public.is_operator_evidence_reviewer() then
    raise exception 'Grid-expert or workspace-owner access is required.';
  end if;
  if p_decision not in ('accepted','rejected') then
    raise exception 'Decision must be accepted or rejected.';
  end if;
  if char_length(trim(p_rationale)) < 10 then
    raise exception 'A review rationale of at least 10 characters is required.';
  end if;

  update public.operator_node_evidence_matches
  set status = p_decision,
      rationale = trim(p_rationale),
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_match_id and status = 'proposed'
  returning * into reviewed_match;

  if not found then
    raise exception 'Proposed match was not found or has already been reviewed.';
  end if;

  if p_decision = 'accepted' then
    update public.canonical_grid_nodes n
    set identity_status = case
          when reviewed_match.match_method in ('source_identifier','manual') then 'reviewed'
          else n.identity_status
        end,
        identity_confidence = greatest(n.identity_confidence, reviewed_match.confidence)
    where n.id = reviewed_match.node_id;
  end if;
  return reviewed_match.id;
end;
$$;

revoke all on function public.review_operator_node_evidence_match(uuid,text,text)
  from public, anon;
grant execute on function public.review_operator_node_evidence_match(uuid,text,text)
  to authenticated;

create or replace function public.operator_evidence_review_queue()
returns table (
  match_id uuid,
  node_id uuid,
  node_name text,
  operator_name text,
  voltage_kv numeric[],
  source_record_id text,
  match_method text,
  confidence numeric,
  distance_m numeric,
  rationale text,
  evidence_title text,
  evidence_url text,
  project_status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id, n.id, n.canonical_name, coalesce(o.canonical_name, n.operator_name),
    n.voltage_kv, n.source_record_id, m.match_method, m.confidence, m.distance_m,
    m.rationale, coalesce(d.title, p.project_name),
    coalesce(d.document_url, p.source_url), p.project_status, m.created_at
  from public.operator_node_evidence_matches m
  join public.canonical_grid_nodes n on n.id = m.node_id
  left join public.grid_operators o on o.id = n.operator_id
  left join public.operator_evidence_documents d on d.id = m.evidence_document_id
  left join public.operator_grid_projects p on p.id = m.grid_project_id
  where m.status = 'proposed' and public.is_operator_evidence_reviewer()
  order by m.confidence desc, m.created_at;
$$;

revoke all on function public.operator_evidence_review_queue() from public, anon;
grant execute on function public.operator_evidence_review_queue() to authenticated;

create table public.operator_engagements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  node_id uuid references public.network_nodes(id) on delete set null,
  canonical_node_id uuid references public.canonical_grid_nodes(id) on delete set null,
  operator_id uuid references public.grid_operators(id) on delete set null,
  submission_package_id uuid references public.submission_packages(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  engagement_type text not null default 'connection_enquiry'
    check (engagement_type in ('connection_enquiry','formal_application','capacity_request','technical_clarification')),
  status text not null default 'draft'
    check (status in (
      'draft','ready','submitted','acknowledged','under_review','information_requested',
      'response_received','offer_received','reserved','declined','withdrawn','expired','closed'
    )),
  operator_reference text,
  recipient_organization text not null,
  recipient_contact text,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  response_due_at timestamptz,
  response_received_at timestamptz,
  offer_expires_at timestamptz,
  reservation_expires_at timestamptz,
  requested_import_mw numeric check (requested_import_mw is null or requested_import_mw >= 0),
  requested_export_mw numeric check (requested_export_mw is null or requested_export_mw >= 0),
  minimum_viable_import_mw numeric
    check (minimum_viable_import_mw is null or minimum_viable_import_mw >= 0),
  target_voltage_kv numeric check (target_voltage_kv is null or target_voltage_kv > 0),
  target_energisation_date date,
  indicated_import_mw numeric check (indicated_import_mw is null or indicated_import_mw >= 0),
  indicated_export_mw numeric check (indicated_export_mw is null or indicated_export_mw >= 0),
  reinforcement_required boolean,
  reinforcement_summary text,
  estimated_connection_cost_eur numeric
    check (estimated_connection_cost_eur is null or estimated_connection_cost_eur >= 0),
  indicated_connection_date date,
  response_document_id uuid references public.assessment_documents(id) on delete set null,
  evidence_state text not null default 'customer_declared'
    check (evidence_state in ('customer_declared','submitted_record','operator_response','operator_confirmed')),
  assumptions text[] not null default '{}',
  open_questions text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (response_due_at is null or submitted_at is null or response_due_at >= submitted_at),
  check (offer_expires_at is null or response_received_at is null or offer_expires_at >= response_received_at),
  check (reservation_expires_at is null or response_received_at is null or reservation_expires_at >= response_received_at)
);

create table public.operator_engagement_events (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.operator_engagements(id) on delete cascade,
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  event_type text not null
    check (event_type in (
      'created','package_linked','submitted','acknowledged','information_requested',
      'response_received','offer_received','reservation_recorded','status_changed',
      'deadline_changed','note'
    )),
  from_status text,
  to_status text,
  occurred_at timestamptz not null default now(),
  source_document_id uuid references public.assessment_documents(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index operator_engagements_site_updated_idx
  on public.operator_engagements(site_id, updated_at desc);
create index operator_engagements_deadline_idx
  on public.operator_engagements(status, response_due_at, offer_expires_at, reservation_expires_at);
create index operator_engagement_events_engagement_idx
  on public.operator_engagement_events(engagement_id, occurred_at desc);

alter table public.operator_engagements enable row level security;
alter table public.operator_engagement_events enable row level security;
grant select, insert, update on public.operator_engagements to authenticated;
grant select on public.operator_engagement_events to authenticated;

create policy "participants read operator engagements"
  on public.operator_engagements for select to authenticated
  using (public.can_read_assessment(site_id));
create policy "editors manage operator engagements"
  on public.operator_engagements for all to authenticated
  using (public.can_edit_assessment(site_id))
  with check (public.can_edit_assessment(site_id) and owner_id = (select auth.uid()));
create policy "participants read operator engagement events"
  on public.operator_engagement_events for select to authenticated
  using (public.can_read_assessment(site_id));

create or replace function public.record_operator_engagement_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_kind text;
begin
  if tg_op = 'INSERT' then
    event_kind := 'created';
  elsif new.status <> old.status then
    event_kind := case new.status
      when 'submitted' then 'submitted'
      when 'acknowledged' then 'acknowledged'
      when 'information_requested' then 'information_requested'
      when 'response_received' then 'response_received'
      when 'offer_received' then 'offer_received'
      when 'reserved' then 'reservation_recorded'
      else 'status_changed'
    end;
  elsif new.response_due_at is distinct from old.response_due_at
     or new.offer_expires_at is distinct from old.offer_expires_at
     or new.reservation_expires_at is distinct from old.reservation_expires_at then
    event_kind := 'deadline_changed';
  else
    return new;
  end if;

  insert into public.operator_engagement_events (
    engagement_id, site_id, actor_id, event_type, from_status, to_status,
    source_document_id, detail
  ) values (
    new.id, new.site_id, (select auth.uid()), event_kind,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status, new.response_document_id,
    jsonb_strip_nulls(jsonb_build_object(
      'operator_reference', new.operator_reference,
      'response_due_at', new.response_due_at,
      'offer_expires_at', new.offer_expires_at,
      'reservation_expires_at', new.reservation_expires_at
    ))
  );
  return new;
end;
$$;

create trigger operator_engagements_set_updated_at
before update on public.operator_engagements
for each row execute function public.set_updated_at();
create trigger operator_engagements_event
after insert or update on public.operator_engagements
for each row execute function public.record_operator_engagement_event();

create or replace function public.promote_engagement_after_operator_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.decision = 'confirmed' and new.source_document_id is not null then
    update public.operator_engagements
    set evidence_state = 'operator_confirmed',
        status = case when status in ('response_received','under_review')
          then 'offer_received' else status end,
        response_document_id = coalesce(response_document_id, new.source_document_id),
        notes = concat_ws(
          E'\n',
          notes,
          'Promoted after signed operator decision ' || new.id::text ||
          '; public Power Finder scoring is not changed by this private project evidence.'
        )
    where site_id = new.site_id
      and (
        node_id = new.node_id
        or (node_id is null and response_document_id = new.source_document_id)
      );
  end if;
  return new;
end;
$$;

create trigger operator_decisions_promote_engagement
after insert on public.operator_decisions
for each row execute function public.promote_engagement_after_operator_decision();

create or replace function public.create_operator_engagement(
  p_site_id uuid,
  p_submission_package_id uuid,
  p_recipient_organization text,
  p_recipient_contact text,
  p_node_id uuid,
  p_canonical_node_id uuid,
  p_operator_id uuid,
  p_open_questions text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.candidate_sites%rowtype;
  engagement_id uuid;
begin
  if not public.can_edit_assessment(p_site_id) then
    raise exception 'Editor access is required.';
  end if;
  select * into site from public.candidate_sites where id = p_site_id;
  if not found then raise exception 'Project not found.'; end if;
  if p_submission_package_id is not null and not exists (
    select 1 from public.submission_packages p
    where p.id = p_submission_package_id and p.site_id = p_site_id
  ) then raise exception 'Submission package does not belong to this project.'; end if;
  if p_node_id is not null and not exists (
    select 1 from public.network_nodes n where n.id = p_node_id and n.site_id = p_site_id
  ) then raise exception 'Project node does not belong to this project.'; end if;

  insert into public.operator_engagements (
    site_id, node_id, canonical_node_id, operator_id, submission_package_id, owner_id,
    recipient_organization, recipient_contact, requested_import_mw,
    requested_export_mw, minimum_viable_import_mw, target_voltage_kv,
    target_energisation_date, open_questions, assumptions, status
  ) values (
    p_site_id, p_node_id, p_canonical_node_id, p_operator_id, p_submission_package_id,
    (select auth.uid()), trim(p_recipient_organization), nullif(trim(p_recipient_contact),''),
    site.requested_import_mw, site.requested_export_mw, site.minimum_viable_import_mw,
    site.target_voltage_kv, site.target_energization_date, coalesce(p_open_questions,'{}'),
    array[
      'Connection feasibility, capacity, cost, responsibility, and dates require operator confirmation.',
      'The linked package is a customer-side enquiry record, not a capacity reservation.'
    ],
    case when p_submission_package_id is null then 'draft' else 'ready' end
  ) returning id into engagement_id;
  return engagement_id;
end;
$$;

revoke all on function public.create_operator_engagement(uuid,uuid,text,text,uuid,uuid,uuid,text[])
  from public, anon;
grant execute on function public.create_operator_engagement(uuid,uuid,text,text,uuid,uuid,uuid,text[])
  to authenticated;

create or replace function public.update_operator_engagement_status(
  p_engagement_id uuid,
  p_status text,
  p_operator_reference text,
  p_occurred_at timestamptz,
  p_response_due_at timestamptz,
  p_offer_expires_at timestamptz,
  p_reservation_expires_at timestamptz,
  p_response_document_id uuid,
  p_indicated_import_mw numeric,
  p_reinforcement_required boolean,
  p_reinforcement_summary text,
  p_estimated_connection_cost_eur numeric,
  p_indicated_connection_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  engagement public.operator_engagements%rowtype;
  next_evidence text;
begin
  select * into engagement from public.operator_engagements where id = p_engagement_id;
  if not found or not public.can_edit_assessment(engagement.site_id) then
    raise exception 'Engagement not found or editor access is required.';
  end if;
  if p_status not in (
    'draft','ready','submitted','acknowledged','under_review','information_requested',
    'response_received','offer_received','reserved','declined','withdrawn','expired','closed'
  ) then raise exception 'Invalid engagement status.'; end if;
  if p_indicated_import_mw is not null and p_response_document_id is null then
    raise exception 'An indicated import value requires a linked operator response document.';
  end if;
  next_evidence := case
    when p_status in ('response_received','offer_received','reserved') and p_response_document_id is not null
      then 'operator_response'
    when p_status in ('submitted','acknowledged','under_review','information_requested')
      then 'submitted_record'
    else engagement.evidence_state
  end;

  update public.operator_engagements set
    status = p_status,
    operator_reference = coalesce(nullif(trim(p_operator_reference),''), operator_reference),
    submitted_at = case when p_status = 'submitted' then coalesce(p_occurred_at, now()) else submitted_at end,
    acknowledged_at = case when p_status = 'acknowledged' then coalesce(p_occurred_at, now()) else acknowledged_at end,
    response_received_at = case when p_status in ('response_received','offer_received','reserved')
      then coalesce(p_occurred_at, now()) else response_received_at end,
    response_due_at = p_response_due_at,
    offer_expires_at = p_offer_expires_at,
    reservation_expires_at = p_reservation_expires_at,
    response_document_id = p_response_document_id,
    indicated_import_mw = p_indicated_import_mw,
    reinforcement_required = p_reinforcement_required,
    reinforcement_summary = nullif(trim(p_reinforcement_summary),''),
    estimated_connection_cost_eur = p_estimated_connection_cost_eur,
    indicated_connection_date = p_indicated_connection_date,
    evidence_state = next_evidence,
    notes = nullif(trim(p_notes),'')
  where id = p_engagement_id;
  return p_engagement_id;
end;
$$;

revoke all on function public.update_operator_engagement_status(
  uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz,uuid,numeric,
  boolean,text,numeric,date,text
) from public, anon;
grant execute on function public.update_operator_engagement_status(
  uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz,uuid,numeric,
  boolean,text,numeric,date,text
) to authenticated;

comment on table public.operator_engagements is
  'Project-specific enquiry and response control. Numeric operator indications require a linked response document and remain distinct from signed operator confirmation.';
