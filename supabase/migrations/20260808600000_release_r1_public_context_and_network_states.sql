-- Release R1: accepted German public context and private physical network-state manifests.

create table if not exists public.public_context_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null,
  release_sha256 text not null check (release_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('candidate','accepted','rejected','superseded')),
  capacity_claim boolean not null default false check (capacity_claim = false),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(release_key, release_sha256)
);

create table if not exists public.public_context_quality_reports (
  id bigint generated always as identity primary key,
  release_id uuid not null references public.public_context_releases(id) on delete cascade,
  source_key text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  parser_version text not null,
  observation_count integer not null check (observation_count >= 0),
  expected_count integer not null check (expected_count >= 0),
  coverage double precision not null check (coverage between 0 and 1),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  missing_count integer not null default 0 check (missing_count >= 0),
  status text not null check (status in ('accepted','rejected')),
  evidence_boundary text not null,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(release_id, source_key)
);

create table if not exists public.network_state_manifests (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.pilot_datasets(id) on delete restrict,
  model_version_id uuid references public.pilot_model_versions(id) on delete restrict,
  scenario_id text not null,
  scenario_sha256 text not null check (scenario_sha256 ~ '^[a-f0-9]{64}$'),
  state_sha256 text not null check (state_sha256 ~ '^[a-f0-9]{64}$'),
  validation_class text not null,
  switching_state text not null,
  queue_project_ids text[] not null default '{}',
  reinforcement_ids text[] not null default '{}',
  weather_year integer,
  hour_of_year integer check (hour_of_year is null or hour_of_year between 0 and 8783),
  provenance jsonb not null,
  created_at timestamptz not null default now(),
  unique(dataset_id, scenario_sha256)
);

alter table public.public_context_releases enable row level security;
alter table public.public_context_quality_reports enable row level security;
alter table public.network_state_manifests enable row level security;
revoke all on public.public_context_releases, public.public_context_quality_reports, public.network_state_manifests from public, anon, authenticated;
grant select, insert, update, delete on public.public_context_releases, public.public_context_quality_reports, public.network_state_manifests to service_role;
grant usage, select on sequence public.public_context_quality_reports_id_seq to service_role;

comment on table public.public_context_releases is 'Accepted SMARD, DWD, MaStR and OSM context releases. The database constraint forbids capacity claims.';
comment on table public.network_state_manifests is 'Private reproducibility ledger for physically effective Release 1 states.';
