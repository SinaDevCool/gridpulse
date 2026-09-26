create table if not exists public.grid_graph_state_spaces (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  state_space_sha256 text not null check (state_space_sha256 ~ '^[a-f0-9]{64}$'),
  axes jsonb not null, theoretical_count bigint not null check (theoretical_count > 0),
  generated_count bigint not null check (generated_count > 0), created_at timestamptz not null default now(),
  unique(model_key, state_space_sha256)
);
create table if not exists public.grid_graph_reduction_validations (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  selection_sha256 text not null check (selection_sha256 ~ '^[a-f0-9]{64}$'),
  validation_sha256 text not null check (validation_sha256 ~ '^[a-f0-9]{64}$'),
  infeasible_recall numeric not null check (infeasible_recall between 0 and 1),
  constraint_recall numeric not null check (constraint_recall between 0 and 1),
  accepted_for_search_reduction boolean not null default false,
  validation_payload jsonb not null, created_at timestamptz not null default now(),
  unique(model_key, validation_sha256)
);
create table if not exists public.grid_graph_portfolio_interactions (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  portfolio_sha256 text not null check (portfolio_sha256 ~ '^[a-f0-9]{64}$'),
  candidate_ids jsonb not null, interaction_payload jsonb not null,
  capacity_claim boolean not null default false check (capacity_claim = false),
  created_at timestamptz not null default now(), unique(model_key, portfolio_sha256)
);
create table if not exists public.grid_graph_study_bundles (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  bundle_sha256 text not null check (bundle_sha256 ~ '^[a-f0-9]{64}$'),
  projection_sha256 text not null, state_sha256 text not null,
  physics_result_sha256 text, reproducible boolean not null default false,
  bundle_payload jsonb not null, invalidated_at timestamptz,
  created_at timestamptz not null default now(), unique(model_key, bundle_sha256)
);
alter table public.grid_graph_state_spaces enable row level security;
alter table public.grid_graph_reduction_validations enable row level security;
alter table public.grid_graph_portfolio_interactions enable row level security;
alter table public.grid_graph_study_bundles enable row level security;
revoke all on public.grid_graph_state_spaces, public.grid_graph_reduction_validations,
  public.grid_graph_portfolio_interactions, public.grid_graph_study_bundles
  from public, anon, authenticated;
grant select, insert, update, delete on public.grid_graph_state_spaces,
  public.grid_graph_reduction_validations, public.grid_graph_portfolio_interactions,
  public.grid_graph_study_bundles to service_role;
