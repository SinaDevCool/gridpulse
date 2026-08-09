create table if not exists public.grid_graph_temporal_snapshots (
  id uuid primary key default gen_random_uuid(), model_key text not null, snapshot_id text not null,
  projection_sha256 text not null check(projection_sha256 ~ '^[a-f0-9]{64}$'),
  valid_from timestamptz not null, valid_to timestamptz,
  source_event_sha256 text, created_at timestamptz not null default now(),
  check(valid_to is null or valid_to > valid_from), unique(model_key, snapshot_id)
);
create table if not exists public.grid_graph_topology_events (
  id uuid primary key default gen_random_uuid(), model_key text not null, sequence bigint not null check(sequence > 0),
  occurred_at timestamptz not null, event_type text not null, asset_id text not null,
  payload jsonb not null, source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(), unique(model_key, sequence), unique(model_key, source_sha256)
);
create table if not exists public.grid_graph_projection_deltas (
  id uuid primary key default gen_random_uuid(), model_key text not null, next_model_key text not null,
  expected_projection_sha256 text not null, next_projection_sha256 text not null,
  delta_sha256 text not null check(delta_sha256 ~ '^[a-f0-9]{64}$'),
  delta_payload jsonb not null, status text not null check(status in ('prepared','applied','rejected','rolled_back')),
  applied_at timestamptz, created_at timestamptz not null default now(), unique(model_key, delta_sha256)
);
create table if not exists public.grid_graph_quality_runs (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  quality_sha256 text not null check(quality_sha256 ~ '^[a-f0-9]{64}$'), metrics jsonb not null,
  checks jsonb not null, accepted boolean not null, invalidate_physics_results boolean not null,
  created_at timestamptz not null default now(), unique(model_key, quality_sha256)
);
create table if not exists public.grid_graph_workspace_policies (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  permitted_regions text[] not null, purposes text[] not null, retention_days integer not null check(retention_days between 1 and 3650),
  allow_model_training boolean not null default false, allow_raw_export boolean not null default false,
  policy_sha256 text not null check(policy_sha256 ~ '^[a-f0-9]{64}$'), active boolean not null default true,
  created_at timestamptz not null default now(), unique(workspace_id, policy_sha256)
);
alter table public.grid_graph_temporal_snapshots enable row level security;
alter table public.grid_graph_topology_events enable row level security;
alter table public.grid_graph_projection_deltas enable row level security;
alter table public.grid_graph_quality_runs enable row level security;
alter table public.grid_graph_workspace_policies enable row level security;
revoke all on public.grid_graph_temporal_snapshots, public.grid_graph_topology_events,
  public.grid_graph_projection_deltas, public.grid_graph_quality_runs,
  public.grid_graph_workspace_policies from public, anon, authenticated;
grant select, insert, update, delete on public.grid_graph_temporal_snapshots,
  public.grid_graph_topology_events, public.grid_graph_projection_deltas,
  public.grid_graph_quality_runs, public.grid_graph_workspace_policies to service_role;
