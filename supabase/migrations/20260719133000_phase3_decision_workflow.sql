-- GridPulse Phase 3: versioned connection strategy, interval results and decision handoff.

alter table public.connection_scenarios
  add column if not exists conditional_import_mw numeric(10,3) not null default 0 check (conditional_import_mw >= 0),
  add column if not exists minimum_critical_load_mw numeric(10,3) check (minimum_critical_load_mw >= 0),
  add column if not exists commercial_exposure_eur numeric(14,2),
  add column if not exists evidence_readiness integer not null default 0 check (evidence_readiness between 0 and 100),
  add column if not exists selection_status text not null default 'candidate'
    check (selection_status in ('candidate','preferred','rejected','archived')),
  add column if not exists selection_rationale text,
  add column if not exists supersedes_id uuid references public.connection_scenarios(id) on delete set null;

create unique index if not exists one_preferred_scenario_per_site_idx
  on public.connection_scenarios(site_id) where selection_status = 'preferred';

alter table public.interval_profiles
  add column if not exists timezone text not null default 'Europe/Berlin',
  add column if not exists quality_status text not null default 'unreviewed'
    check (quality_status in ('unreviewed','valid','warning','rejected')),
  add column if not exists quality_report jsonb not null default '{}'::jsonb,
  add column if not exists calculation_version text;

create table if not exists public.flexibility_simulations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  scenario_id uuid references public.connection_scenarios(id) on delete set null,
  profile_id uuid not null references public.interval_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null,
  settings jsonb not null,
  summary jsonb not null,
  timeline jsonb not null,
  calculation_version text not null,
  created_at timestamptz not null default now(),
  unique(site_id, profile_id, version)
);

create table if not exists public.connection_decisions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  scenario_id uuid not null references public.connection_scenarios(id) on delete restrict,
  package_id uuid references public.operator_packages(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null,
  status text not null default 'draft' check (status in ('draft','approved','superseded')),
  rationale text not null,
  alternatives_rejected jsonb not null default '[]'::jsonb,
  conditions_to_proceed jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  evidence_ids uuid[] not null default '{}',
  decision_owner text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(site_id, version)
);

alter table public.operator_packages drop constraint if exists operator_packages_status_check;
alter table public.operator_packages add constraint operator_packages_status_check
  check (status in ('draft','internal_review','approved','issued','superseded'));

create index if not exists flexibility_simulations_site_idx on public.flexibility_simulations(site_id);
create index if not exists connection_decisions_site_idx on public.connection_decisions(site_id);

alter table public.flexibility_simulations enable row level security;
alter table public.connection_decisions enable row level security;

create policy "participants read flexibility simulations" on public.flexibility_simulations for select
  using (public.can_read_assessment(site_id));
create policy "editors create flexibility simulations" on public.flexibility_simulations for insert
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));
create policy "participants read connection decisions" on public.connection_decisions for select
  using (public.can_read_assessment(site_id));
create policy "editors create connection decisions" on public.connection_decisions for insert
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));

-- Issued records remain immutable; only pre-issue lifecycle states may change.
create policy "editors update draft packages" on public.operator_packages for update
  using (public.can_edit_assessment(site_id) and status in ('draft','internal_review','approved'))
  with check (public.can_edit_assessment(site_id) and status in ('draft','internal_review','approved','issued'));
