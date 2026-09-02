-- P0-P4 private computation ledger. No anonymous/public grants are created.
create table if not exists public.grid_scenario_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  project_id uuid,
  pipeline_version text not null,
  model_id text not null,
  model_version text not null,
  validation_class text not null check (validation_class in ('synthetic_demonstration','operator_model_unvalidated','operator_model_reconciled','operator_reviewed','operator_confirmed')),
  dataset_hash text not null,
  seed bigint,
  phase text not null check (phase in ('p0','p1','p2','p3','p4')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  progress_completed integer not null default 0,
  progress_total integer not null default 0,
  configuration jsonb not null default '{}'::jsonb,
  summary jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists grid_scenario_runs_idempotency on public.grid_scenario_runs(owner_id, phase, model_id, model_version, dataset_hash, coalesce(seed, -1));

create table if not exists public.grid_scenario_results (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.grid_scenario_runs(id) on delete cascade,
  scenario_id text not null,
  input_hash text not null,
  input_payload jsonb not null,
  source_kind text not null,
  status text not null check (status in ('succeeded','failed','quarantined')),
  import_capacity_mw double precision,
  export_capacity_mw double precision,
  binding_case text,
  binding_constraint text,
  physics_verified boolean not null default false,
  solver text,
  solver_version text,
  error jsonb,
  created_at timestamptz not null default now(),
  unique(run_id, input_hash),
  check (physics_verified or (import_capacity_mw is null and export_capacity_mw is null))
);
create index if not exists grid_scenario_results_run on public.grid_scenario_results(run_id, status);

create table if not exists public.grid_surrogate_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  model_key text not null,
  model_version text not null,
  training_run_id uuid references public.grid_scenario_runs(id),
  dataset_hash text not null,
  feature_schema jsonb not null,
  hyperparameters jsonb not null,
  metrics jsonb not null,
  training_validation_classes text[] not null,
  operator_trained boolean not null default false,
  approved_use text not null,
  prohibited_use text not null,
  artifact_uri text,
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','retired')),
  created_at timestamptz not null default now(),
  unique(owner_id, model_key, model_version)
);

create table if not exists public.grid_active_learning_rounds (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.grid_scenario_runs(id) on delete cascade,
  round_number integer not null check (round_number >= 0),
  candidate_count integer not null,
  selected_count integer not null,
  mandatory_contingencies text[] not null default '{}',
  acquisition_configuration jsonb not null,
  prior_metrics jsonb not null,
  new_metrics jsonb,
  decision text check (decision in ('promote','reject','continue')),
  rollback_required boolean not null default false,
  created_at timestamptz not null default now(),
  unique(run_id, round_number)
);

alter table public.grid_scenario_runs enable row level security;
alter table public.grid_scenario_results enable row level security;
alter table public.grid_surrogate_models enable row level security;
alter table public.grid_active_learning_rounds enable row level security;
revoke all on public.grid_scenario_runs, public.grid_scenario_results, public.grid_surrogate_models, public.grid_active_learning_rounds from anon;
revoke all on public.grid_scenario_runs, public.grid_scenario_results, public.grid_surrogate_models, public.grid_active_learning_rounds from authenticated;
grant select, insert, update, delete on public.grid_scenario_runs, public.grid_scenario_results, public.grid_surrogate_models, public.grid_active_learning_rounds to service_role;
grant usage, select on sequence public.grid_scenario_results_id_seq to service_role;
