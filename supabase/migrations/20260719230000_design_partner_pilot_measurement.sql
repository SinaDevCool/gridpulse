-- Design-partner pilot onboarding and defensible before/after measurement.

create table public.pilot_engagements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.candidate_sites(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'onboarding' check (status in ('onboarding','baseline','active','operator_review','completed','paused')),
  customer_organization text not null,
  customer_decision_owner text not null,
  project_sector text not null check (project_sector in ('data_centre','bess','industrial_load','electrolyser','generation','other')),
  project_location text not null,
  responsible_dso text,
  responsible_tso text,
  operator_contact_name text,
  operator_contact_email text,
  requested_import_mw numeric not null check (requested_import_mw >= 0),
  minimum_viable_import_mw numeric check (minimum_viable_import_mw >= 0),
  requested_export_mw numeric check (requested_export_mw >= 0),
  target_energization_date date,
  flexibility_summary text,
  pilot_objective text not null,
  success_definition text not null,
  engagement_authorized boolean not null default false,
  anonymized_case_study_allowed boolean not null default false,
  quotation_publication_allowed boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (minimum_viable_import_mw is null or minimum_viable_import_mw <= requested_import_mw),
  check (operator_contact_email is null or operator_contact_email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')
);

create table public.pilot_outcome_observations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  engagement_id uuid not null references public.pilot_engagements(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stage text not null check (stage in ('baseline','interim','final')),
  assessment_elapsed_days numeric check (assessment_elapsed_days >= 0),
  preparation_hours numeric check (preparation_hours >= 0),
  evidence_gaps_count integer check (evidence_gaps_count >= 0),
  sites_compared_count integer check (sites_compared_count >= 0),
  operator_questions_count integer check (operator_questions_count >= 0),
  clarification_rounds_count integer check (clarification_rounds_count >= 0),
  rework_hours_avoided numeric check (rework_hours_avoided >= 0),
  customer_hours_saved numeric check (customer_hours_saved >= 0),
  operator_validated_mw numeric check (operator_validated_mw >= 0),
  strategy_outcome text check (strategy_outcome in ('unchanged','strengthened','changed','blocked','pending_operator')),
  material_risk_exposed boolean,
  next_decision_improved boolean,
  operator_feedback_received boolean,
  evidence_document_ids uuid[] not null default '{}',
  notes text not null,
  customer_confirmed boolean not null default false,
  confirmed_by_name text,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz not null default now()
);

create index pilot_outcomes_site_stage_idx on public.pilot_outcome_observations(site_id, stage, observed_at desc);

alter table public.pilot_engagements enable row level security;
alter table public.pilot_outcome_observations enable row level security;

create policy "participants read pilot engagements" on public.pilot_engagements
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors create pilot engagements" on public.pilot_engagements
  for insert to authenticated with check (public.can_edit_assessment(site_id) and user_id = auth.uid());
create policy "editors update pilot engagements" on public.pilot_engagements
  for update to authenticated using (public.can_edit_assessment(site_id))
  with check (public.can_edit_assessment(site_id));

create policy "participants read pilot observations" on public.pilot_outcome_observations
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors add pilot observations" on public.pilot_outcome_observations
  for insert to authenticated with check (
    public.can_edit_assessment(site_id)
    and user_id = auth.uid()
    and exists (select 1 from public.pilot_engagements e where e.id = engagement_id and e.site_id = site_id)
  );

revoke all on table public.pilot_engagements from anon;
revoke all on table public.pilot_outcome_observations from anon;
grant select, insert, update on table public.pilot_engagements to authenticated;
grant select, insert on table public.pilot_outcome_observations to authenticated;

create trigger pilot_engagements_updated_at before update on public.pilot_engagements
  for each row execute function public.set_updated_at();
create trigger pilot_engagements_activity after insert or update on public.pilot_engagements
  for each row execute function public.log_assessment_change();
create trigger pilot_observations_activity after insert on public.pilot_outcome_observations
  for each row execute function public.log_assessment_change();

comment on table public.pilot_engagements is 'One controlled design-partner pilot definition per assessment.';
comment on table public.pilot_outcome_observations is 'Append-only before/interim/after pilot measurements; commercial claims require customer confirmation and source evidence.';
