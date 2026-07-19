-- GridPulse Phase 2: source-aware site screening and flexible connection strategy.
-- Additive by design: existing candidate_sites and assessment_* records remain valid.

alter table public.candidate_sites
  add column if not exists project_kind text,
  add column if not exists minimum_viable_import_mw numeric(10,3) check (minimum_viable_import_mw >= 0),
  add column if not exists land_status text not null default 'unknown'
    check (land_status in ('unknown','identified','optioned','controlled')),
  add column if not exists planning_status text not null default 'unknown'
    check (planning_status in ('unknown','not_started','pre_application','submitted','approved')),
  add column if not exists single_line_diagram_ready boolean not null default false,
  add column if not exists cable_route_status text not null default 'unknown'
    check (cable_route_status in ('unknown','indicative','secured')),
  add column if not exists finance_status text not null default 'unknown'
    check (finance_status in ('unknown','indicative','committed')),
  add column if not exists load_factor numeric(5,4) check (load_factor between 0 and 1),
  add column if not exists ramp_rate_mw_min numeric(10,3) check (ramp_rate_mw_min >= 0),
  add column if not exists redundancy_requirement text;

create table if not exists public.evidence_claims (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 2 and 240),
  value jsonb,
  evidence_class text not null check (evidence_class in ('customer_declared','public_source','derived','operator_confirmed')),
  confidence text not null default 'unverified' check (confidence in ('unverified','indicative','supported','confirmed')),
  validation_status text not null default 'missing' check (validation_status in ('missing','collected','needs_review','validated','rejected','expired')),
  source_evidence_ids uuid[] not null default '{}',
  method text,
  assumptions jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  operator_validation_required boolean not null default true,
  observed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_site_candidates (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  latitude numeric(9,6) not null check (latitude between 47 and 56),
  longitude numeric(9,6) not null check (longitude between 5 and 16),
  municipality text,
  federal_state text,
  likely_dso text,
  likely_tso text,
  target_voltage_kv numeric(10,3) check (target_voltage_kv > 0),
  infrastructure_context jsonb not null default '{}'::jsonb,
  maturity_score integer not null default 0 check (maturity_score between 0 and 100),
  screening_status text not null default 'draft' check (screening_status in ('draft','screened','operator_review','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.connection_scenarios
  add column if not exists scenario_type text,
  add column if not exists eventual_import_mw numeric(10,3) check (eventual_import_mw >= 0),
  add column if not exists firmness text check (firmness in ('firm','conditional','mixed')),
  add column if not exists outcome text check (outcome in ('screening_candidate','requires_operator_study','requires_reinforcement','commercially_unacceptable','operator_supported','rejected')),
  add column if not exists enabling_assets jsonb not null default '[]'::jsonb,
  add column if not exists dependencies jsonb not null default '[]'::jsonb,
  add column if not exists unresolved_evidence jsonb not null default '[]'::jsonb,
  add column if not exists provenance jsonb not null default '{}'::jsonb;

create table if not exists public.flexibility_profiles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  requested_import_mw numeric(10,3) not null check (requested_import_mw >= 0),
  firm_import_mw numeric(10,3) not null check (firm_import_mw >= 0),
  conditional_import_mw numeric(10,3) not null default 0 check (conditional_import_mw >= 0),
  minimum_critical_load_mw numeric(10,3) not null check (minimum_critical_load_mw >= 0),
  shiftable_load_mw numeric(10,3) not null default 0 check (shiftable_load_mw >= 0),
  battery_power_mw numeric(10,3) not null default 0 check (battery_power_mw >= 0),
  battery_energy_mwh numeric(10,3) not null default 0 check (battery_energy_mwh >= 0),
  restriction_duration_hours numeric(10,3) not null default 0 check (restriction_duration_hours >= 0),
  restriction_events_per_year integer not null default 0 check (restriction_events_per_year >= 0),
  notification_lead_minutes integer check (notification_lead_minutes >= 0),
  workload_transfer_notes text,
  commercial_assumptions jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  calculation_version text not null default 'de-fca-envelope-v2',
  status text not null default 'draft' check (status in ('draft','calculated','submitted','operator_supported','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operator_packages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null,
  status text not null default 'draft' check (status in ('draft','issued','superseded')),
  manifest jsonb not null default '{}'::jsonb,
  snapshot jsonb not null,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, version)
);

create table if not exists public.decision_trace_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  memo_id uuid references public.decision_memos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  item_kind text not null check (item_kind in ('requirement','evidence','assumption','scenario','decision','action')),
  label text not null,
  parent_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  confidence text not null default 'unverified' check (confidence in ('unverified','indicative','supported','confirmed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists evidence_claims_site_id_idx on public.evidence_claims(site_id);
create index if not exists project_site_candidates_site_id_idx on public.project_site_candidates(site_id);
create index if not exists flexibility_profiles_site_id_idx on public.flexibility_profiles(site_id);
create index if not exists operator_packages_site_id_idx on public.operator_packages(site_id);
create index if not exists decision_trace_items_site_id_idx on public.decision_trace_items(site_id);

alter table public.evidence_claims enable row level security;
alter table public.project_site_candidates enable row level security;
alter table public.flexibility_profiles enable row level security;
alter table public.operator_packages enable row level security;
alter table public.decision_trace_items enable row level security;

create policy "participants read evidence claims" on public.evidence_claims for select
  using (public.can_read_assessment(site_id));
create policy "editors manage evidence claims" on public.evidence_claims for all
  using (public.can_edit_assessment(site_id))
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));
create policy "participants read site candidates" on public.project_site_candidates for select
  using (public.can_read_assessment(site_id));
create policy "editors manage site candidates" on public.project_site_candidates for all
  using (public.can_edit_assessment(site_id))
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));
create policy "participants read flexibility profiles" on public.flexibility_profiles for select
  using (public.can_read_assessment(site_id));
create policy "editors manage flexibility profiles" on public.flexibility_profiles for all
  using (public.can_edit_assessment(site_id))
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));
create policy "participants read operator packages" on public.operator_packages for select
  using (public.can_read_assessment(site_id));
create policy "editors create operator packages" on public.operator_packages for insert
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));
create policy "participants read decision trace" on public.decision_trace_items for select
  using (public.can_read_assessment(site_id));
create policy "editors create decision trace" on public.decision_trace_items for insert
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));

create trigger evidence_claims_set_updated_at before update on public.evidence_claims
  for each row execute function public.set_updated_at();
create trigger project_site_candidates_set_updated_at before update on public.project_site_candidates
  for each row execute function public.set_updated_at();
create trigger flexibility_profiles_set_updated_at before update on public.flexibility_profiles
  for each row execute function public.set_updated_at();
