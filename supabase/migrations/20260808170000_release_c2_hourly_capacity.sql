-- Release C2: versioned German hourly context and capacity ensembles.
-- Public output is summary-only. Raw hourly arrays and source releases remain
-- server-side; node envelopes require a reviewed C1 model-to-node link.

create table if not exists public.hourly_context_releases (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  metric text not null,
  unit text not null,
  source_url text not null check (source_url ~ '^https://'),
  licence text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  observation_count integer not null check (observation_count > 0),
  provenance jsonb not null default '{}'::jsonb,
  status text not null check (status in ('staged', 'accepted', 'superseded', 'rejected')),
  created_at timestamptz not null default now(),
  unique (source_key, artifact_sha256)
);

create table if not exists public.hourly_capacity_ensembles (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  model_version text not null,
  connection_point_id uuid references public.grid_model_connection_points(id) on delete restrict,
  validation_class text not null check (validation_class in (
    'synthetic_demonstration', 'operator_model_unvalidated', 'operator_model_reconciled',
    'operator_reviewed', 'operator_confirmed'
  )),
  target_year integer not null check (target_year between 2026 and 2100),
  weather_years integer[] not null check (cardinality(weather_years) >= 2),
  input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
  source_release_ids uuid[] not null,
  summary jsonb not null,
  hourly jsonb not null,
  limitations jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (model_key, model_version, input_sha256)
);

create index if not exists hourly_capacity_ensembles_point_idx
  on public.hourly_capacity_ensembles (connection_point_id, target_year, completed_at desc);

alter table public.hourly_context_releases enable row level security;
alter table public.hourly_capacity_ensembles enable row level security;
revoke all on public.hourly_context_releases from anon, authenticated;
revoke all on public.hourly_capacity_ensembles from anon, authenticated;

create or replace function public.power_finder_public_c2_envelope(node_record_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with node_result as (
    select jsonb_build_object(
      'available', true,
      'validation_class', ensemble.validation_class,
      'target_year', ensemble.target_year,
      'weather_years', ensemble.weather_years,
      'completed_at', ensemble.completed_at,
      'summary', ensemble.summary,
      'limitations', ensemble.limitations,
      'model', jsonb_build_object('key', ensemble.model_key, 'version', ensemble.model_version)
    ) payload
    from public.canonical_grid_nodes node
    join public.grid_model_connection_points point
      on point.canonical_node_id = node.id and point.match_state = 'reviewed'
    join public.hourly_capacity_ensembles ensemble on ensemble.connection_point_id = point.id
    where node.source_record_id = node_record_id
      and ensemble.validation_class in ('operator_reviewed', 'operator_confirmed')
    order by ensemble.completed_at desc
    limit 1
  ), benchmark as (
    select jsonb_build_object(
      'available', true,
      'validation_class', ensemble.validation_class,
      'target_year', ensemble.target_year,
      'weather_years', ensemble.weather_years,
      'completed_at', ensemble.completed_at,
      'summary', ensemble.summary,
      'limitations', ensemble.limitations,
      'model', jsonb_build_object('key', ensemble.model_key, 'version', ensemble.model_version),
      'sources', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'source_key', source.source_key,
          'metric', source.metric,
          'source_url', source.source_url,
          'licence', source.licence,
          'provenance', source.provenance
        )), '[]'::jsonb)
        from public.hourly_context_releases source
        where source.id = any(ensemble.source_release_ids)
      )
    ) payload
    from public.hourly_capacity_ensembles ensemble
    where ensemble.validation_class = 'synthetic_demonstration'
      and ensemble.connection_point_id is null
    order by ensemble.completed_at desc
    limit 1
  )
  select jsonb_build_object(
    'node_envelope', coalesce((select payload from node_result), jsonb_build_object(
      'available', false,
      'reason', 'No reviewed operator hourly model is linked to this mapped node.'
    )),
    'benchmark_ensemble', coalesce((select payload from benchmark), jsonb_build_object(
      'available', false,
      'reason', 'No C2 benchmark ensemble has been published.'
    )),
    'evidence_boundary',
      'Public German hourly data adds system, weather and asset context. It does not establish node capacity without an operator model and review.'
  );
$$;

revoke all on function public.power_finder_public_c2_envelope(text) from public, anon, authenticated;
grant execute on function public.power_finder_public_c2_envelope(text) to anon, authenticated;
