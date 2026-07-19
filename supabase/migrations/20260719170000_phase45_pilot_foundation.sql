-- Phase 4.5: pilot-ready evidence, review, operational simulation and integration boundary.

alter table public.candidate_sites
  add column if not exists technical_configuration jsonb not null default '{}'::jsonb,
  add column if not exists ramp_up_stages jsonb not null default '[]'::jsonb,
  add column if not exists flexibility_constraints jsonb not null default '{}'::jsonb,
  add column if not exists review_stage text not null default 'draft'
    check (review_stage in ('draft','customer_complete','technical_review','expert_review','operator_ready','superseded'));

alter table public.assessment_documents
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists expires_at timestamptz,
  add column if not exists visibility text not null default 'participants'
    check (visibility in ('participants','reviewers','administrators')),
  add column if not exists supersedes_id uuid references public.assessment_documents(id) on delete set null,
  add column if not exists checksum text;

create table if not exists public.assessment_reviews (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('customer_contributor','technical_reviewer','commercial_reviewer','grid_expert','workspace_admin')),
  subject_type text not null,
  subject_id text,
  status text not null default 'open' check (status in ('open','accepted','challenged')),
  note text not null,
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.operations_simulations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  scenario_id uuid references public.connection_scenarios(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  status text not null default 'simulation' check (status in ('simulation','completed','superseded')),
  event_source text not null default 'fixture',
  events jsonb not null default '[]'::jsonb,
  results jsonb not null default '[]'::jsonb,
  disclaimer text not null default 'Simulation—not a network instruction.',
  calculation_version text not null default 'de-pilot-foundation-v1',
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_metrics (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  metric_key text not null,
  metric_value numeric not null,
  unit text not null,
  source text not null default 'customer_declared',
  observed_at timestamptz not null default now(),
  notes text,
  unique(site_id, metric_key, observed_at)
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('network_limit','capacity_evidence','project_submission','telemetry','dispatch_response')),
  organization text not null,
  evidence_state text not null check (evidence_state in ('declared','reviewed','operator_confirmed','expired')),
  valid_from timestamptz not null,
  valid_to timestamptz,
  schema_version text not null default 'gridpulse.integration.v1',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists assessment_reviews_site_idx on public.assessment_reviews(site_id);
create index if not exists operations_simulations_site_idx on public.operations_simulations(site_id);
create index if not exists pilot_metrics_site_idx on public.pilot_metrics(site_id);
create index if not exists integration_events_site_idx on public.integration_events(site_id);

alter table public.assessment_reviews enable row level security;
alter table public.operations_simulations enable row level security;
alter table public.pilot_metrics enable row level security;
alter table public.integration_events enable row level security;

create policy "participants read assessment reviews" on public.assessment_reviews for select using (public.can_read_assessment(site_id));
create policy "editors manage assessment reviews" on public.assessment_reviews for all using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "participants read operations simulations" on public.operations_simulations for select using (public.can_read_assessment(site_id));
create policy "editors manage operations simulations" on public.operations_simulations for all using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "participants read pilot metrics" on public.pilot_metrics for select using (public.can_read_assessment(site_id));
create policy "editors manage pilot metrics" on public.pilot_metrics for all using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "participants read integration events" on public.integration_events for select using (public.can_read_assessment(site_id));
create policy "editors manage integration events" on public.integration_events for all using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));

comment on table public.operations_simulations is 'Non-production operational simulation only; never a network instruction.';
comment on table public.integration_events is 'Mockable Phase 5 integration boundary with provenance and operator-control semantics.';
