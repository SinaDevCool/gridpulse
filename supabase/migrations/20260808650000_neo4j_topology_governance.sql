-- Private Neo4j topology projections and graph-guided study ledger.
create table if not exists public.grid_graph_projections (
  id uuid primary key default gen_random_uuid(),
  model_id text not null, model_version text not null,
  projection_sha256 text not null check (projection_sha256 ~ '^[a-f0-9]{64}$'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  validation_class text not null,
  node_count integer not null check (node_count >= 0),
  relationship_count integer not null check (relationship_count >= 0),
  round_trip_valid boolean not null default false,
  status text not null check (status in ('projecting','accepted','rejected','superseded')),
  created_at timestamptz not null default now(),
  unique(model_id, model_version, projection_sha256)
);
create table if not exists public.grid_topology_studies (
  id uuid primary key default gen_random_uuid(),
  analytics_job_id uuid not null references public.analytics_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.operator_pilot_workspaces(id) on delete restrict,
  model_id text not null, model_version text not null,
  projection_sha256 text not null check (projection_sha256 ~ '^[a-f0-9]{64}$'),
  study_sha256 text not null check (study_sha256 ~ '^[a-f0-9]{64}$'),
  topology_audit jsonb not null, pathway_summary jsonb not null,
  scenario_selection jsonb not null, validation_summary jsonb not null,
  capacity_claim boolean not null default false check (capacity_claim = false),
  status text not null check (status in ('completed','review_required','approved','rejected')),
  created_at timestamptz not null default now(), unique(analytics_job_id, study_sha256)
);
alter table public.grid_graph_projections enable row level security;
alter table public.grid_topology_studies enable row level security;
revoke all on public.grid_graph_projections, public.grid_topology_studies
  from public, anon, authenticated;
grant select, insert, update, delete on public.grid_graph_projections,
  public.grid_topology_studies to service_role;
