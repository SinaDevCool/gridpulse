create table if not exists public.grid_cgmes_imports (
  id uuid primary key default gen_random_uuid(), model_key text not null, model_version text not null,
  source_sha256 text not null, manifest jsonb not null, validation_class text not null default 'operator_model_unvalidated',
  created_at timestamptz not null default now(), unique(model_key, model_version, source_sha256)
);
create table if not exists public.grid_topology_states (
  id uuid primary key default gen_random_uuid(), model_key text not null, state_id text not null,
  state_sha256 text not null, switch_positions jsonb not null default '{}'::jsonb,
  unavailable_assets jsonb not null default '[]'::jsonb, reason text not null,
  created_at timestamptz not null default now(), unique(model_key, state_sha256)
);
create table if not exists public.grid_graph_algorithm_runs (
  id uuid primary key default gen_random_uuid(), model_key text not null, projection_sha256 text not null,
  algorithm text not null, algorithm_version text not null, config_sha256 text not null,
  result_sha256 text not null, runtime_ms numeric not null check(runtime_ms >= 0),
  memory_estimate jsonb, approved_use text not null, prohibited_use jsonb not null,
  display_as_capacity boolean not null default false check(display_as_capacity = false),
  created_at timestamptz not null default now()
);
alter table public.grid_cgmes_imports enable row level security;
alter table public.grid_topology_states enable row level security;
alter table public.grid_graph_algorithm_runs enable row level security;
revoke all on public.grid_cgmes_imports, public.grid_topology_states, public.grid_graph_algorithm_runs from public, anon, authenticated;
grant select, insert, update, delete on public.grid_cgmes_imports, public.grid_topology_states, public.grid_graph_algorithm_runs to service_role;
