-- Release 2: private surrogate-routing and active-learning audit ledger.
-- Surrogate values are structurally prohibited from being public capacity claims.

create table if not exists public.grid_surrogate_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.grid_scenario_runs(id) on delete cascade,
  dataset_hash text not null check (dataset_hash ~ '^[a-f0-9]{64}$'),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  format text not null,
  artifact_uri text,
  public_visibility text not null check (public_visibility = 'private_internal_only'),
  created_at timestamptz not null default now(),
  unique(run_id, artifact_sha256)
);

create table if not exists public.grid_active_learning_candidates (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.grid_scenario_runs(id) on delete cascade,
  round_number integer not null check (round_number >= 0),
  scenario_id text not null,
  scenario_sha256 text not null check (scenario_sha256 ~ '^[a-f0-9]{64}$'),
  surrogate_capacity_mw double precision not null,
  feasibility_probability double precision,
  binding_constraint text not null,
  uncertainty_span_mw double precision not null check (uncertainty_span_mw >= 0),
  out_of_distribution boolean not null,
  out_of_distribution_distance double precision not null check (out_of_distribution_distance >= 0),
  requires_physics_verification boolean not null check (requires_physics_verification = true),
  display_as_capacity boolean not null check (display_as_capacity = false),
  selected_for_physics boolean not null,
  created_at timestamptz not null default now(),
  unique(run_id, round_number, scenario_sha256)
);

create table if not exists public.grid_rare_event_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.grid_scenario_runs(id) on delete cascade,
  search_version text not null,
  result jsonb not null,
  physics_verified boolean not null,
  created_at timestamptz not null default now(),
  unique(run_id, search_version)
);

create table if not exists public.grid_model_promotion_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.grid_scenario_runs(id) on delete cascade,
  model_dataset_hash text not null check (model_dataset_hash ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('promote','reject')),
  rollback_required boolean not null,
  false_safe_rate double precision not null check (false_safe_rate between 0 and 1),
  mae_improvement_mw double precision not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique(run_id, model_dataset_hash)
);

alter table public.grid_surrogate_artifacts enable row level security;
alter table public.grid_active_learning_candidates enable row level security;
alter table public.grid_rare_event_results enable row level security;
alter table public.grid_model_promotion_decisions enable row level security;

revoke all on public.grid_surrogate_artifacts, public.grid_active_learning_candidates,
  public.grid_rare_event_results, public.grid_model_promotion_decisions
  from public, anon, authenticated;
grant select, insert, update, delete on public.grid_surrogate_artifacts,
  public.grid_active_learning_candidates, public.grid_rare_event_results,
  public.grid_model_promotion_decisions to service_role;
grant usage, select on sequence public.grid_active_learning_candidates_id_seq to service_role;

comment on table public.grid_active_learning_candidates is
  'Private AI prioritisation ledger. Database constraints forbid treating predictions as capacity.';
