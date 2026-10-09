-- Release C1: versioned electrical models and immutable AC study results.
-- Public map records are linked only after a reviewed identity match. Benchmark
-- results remain synthetic demonstrations and never become capacity observations.

create table if not exists public.grid_model_versions (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  version text not null,
  validation_class text not null check (validation_class in (
    'public_screening', 'synthetic_demonstration', 'operator_model_unvalidated',
    'operator_model_reconciled', 'operator_reviewed', 'operator_confirmed'
  )),
  source_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  licence text not null,
  model_sha256 text not null check (model_sha256 ~ '^[0-9a-f]{64}$'),
  model_format text not null,
  object_path text,
  element_counts jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (model_key, version, model_sha256)
);

create table if not exists public.grid_model_connection_points (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.grid_model_versions(id) on delete restrict,
  model_bus_id text not null,
  canonical_node_id uuid references public.canonical_grid_nodes(id) on delete restrict,
  match_state text not null check (match_state in ('benchmark_only', 'proposed', 'reviewed')),
  match_evidence jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (model_version_id, model_bus_id)
);

create table if not exists public.network_study_runs (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.grid_model_versions(id) on delete restrict,
  connection_point_id uuid not null references public.grid_model_connection_points(id) on delete restrict,
  study_type text not null check (study_type in ('base_case', 'voltage', 'contingency', 'capacity')),
  status text not null check (status in ('succeeded', 'failed')),
  validation_class text not null check (validation_class in (
    'synthetic_demonstration', 'operator_model_unvalidated', 'operator_model_reconciled',
    'operator_reviewed', 'operator_confirmed'
  )),
  solver text not null,
  solver_version text not null,
  input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
  assumptions jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists network_study_runs_lookup_idx
  on public.network_study_runs (connection_point_id, study_type, completed_at desc);
create unique index if not exists network_study_runs_idempotency_idx
  on public.network_study_runs (model_version_id, connection_point_id, study_type, input_sha256);

alter table public.grid_model_versions enable row level security;
alter table public.grid_model_connection_points enable row level security;
alter table public.network_study_runs enable row level security;
revoke all on public.grid_model_versions from anon, authenticated;
revoke all on public.grid_model_connection_points from anon, authenticated;
revoke all on public.network_study_runs from anon, authenticated;

create or replace function public.power_finder_public_c1_study(node_record_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with node_result as (
    select jsonb_build_object(
      'available', true,
      'study_type', run.study_type,
      'validation_class', run.validation_class,
      'solver', run.solver,
      'solver_version', run.solver_version,
      'completed_at', run.completed_at,
      'result', run.result,
      'limitations', run.limitations,
      'model', jsonb_build_object(
        'key', model.model_key,
        'version', model.version,
        'source_name', model.source_name,
        'source_url', model.source_url,
        'licence', model.licence,
        'sha256', model.model_sha256
      )
    ) as payload
    from public.canonical_grid_nodes node
    join public.grid_model_connection_points point
      on point.canonical_node_id = node.id and point.match_state = 'reviewed'
    join public.grid_model_versions model on model.id = point.model_version_id
    join public.network_study_runs run on run.connection_point_id = point.id
    where node.source_record_id = node_record_id
      and run.status = 'succeeded'
      and run.study_type = 'capacity'
      and run.validation_class in ('operator_reviewed', 'operator_confirmed')
    order by run.completed_at desc
    limit 1
  ), benchmark as (
    select jsonb_build_object(
      'available', true,
      'validation_class', run.validation_class,
      'solver', run.solver,
      'solver_version', run.solver_version,
      'completed_at', run.completed_at,
      'result', run.result,
      'limitations', run.limitations,
      'model', jsonb_build_object(
        'key', model.model_key,
        'version', model.version,
        'source_name', model.source_name,
        'source_url', model.source_url,
        'licence', model.licence,
        'sha256', model.model_sha256
      )
    ) as payload
    from public.network_study_runs run
    join public.grid_model_connection_points point on point.id = run.connection_point_id
    join public.grid_model_versions model on model.id = point.model_version_id
    where point.match_state = 'benchmark_only'
      and run.status = 'succeeded' and run.study_type = 'capacity'
      and run.validation_class = 'synthetic_demonstration'
    order by run.completed_at desc
    limit 1
  )
  select jsonb_build_object(
    'node_study', coalesce((select payload from node_result), jsonb_build_object(
      'available', false,
      'reason', 'No reviewed operator electrical model is linked to this mapped node.'
    )),
    'benchmark_validation', coalesce((select payload from benchmark), jsonb_build_object(
      'available', false,
      'reason', 'No C1 benchmark validation has been published.'
    )),
    'evidence_boundary',
      'Benchmark solver validation is not location capacity. Node results are exposed only after reviewed model-to-node linkage.'
  );
$$;

revoke all on function public.power_finder_public_c1_study(text) from public, anon, authenticated;
grant execute on function public.power_finder_public_c1_study(text) to anon, authenticated;
