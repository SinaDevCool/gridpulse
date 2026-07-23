-- Power Finder vertical slice: canonical, source-aware public grid context.
-- These records are screening inputs. They are not proof of available capacity.

create extension if not exists postgis with schema extensions;

create table public.grid_sources (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{2,79}$'),
  publisher text not null,
  title text not null,
  source_url text not null,
  licence text not null,
  attribution text not null,
  geographic_scope text not null,
  evidence_class text not null
    check (evidence_class in ('official_operator','official_regulatory','official_public','open_mapping','test_fixture')),
  refresh_cadence text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grid_source_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_url text not null,
  storage_path text,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  content_type text not null,
  etag text,
  last_modified text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  connector_version text not null,
  parser_version text not null,
  record_count integer check (record_count is null or record_count >= 0),
  validation_report jsonb not null default '{}'::jsonb,
  status text not null default 'staged'
    check (status in ('staged','validated','active','quarantined','superseded')),
  unique(source_id, sha256)
);

create table public.canonical_grid_nodes (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_artifact_id uuid references public.grid_source_artifacts(id) on delete set null,
  source_record_id text not null,
  canonical_name text not null,
  node_type text not null
    check (node_type in ('substation','switching_station','connection_point','grid_interface','unknown')),
  operator_name text,
  voltage_kv numeric[] not null default '{}',
  geometry extensions.geometry(Point, 4326) not null,
  operational_status text not null default 'unknown'
    check (operational_status in ('operational','construction','planned','out_of_service','unknown')),
  location_precision text not null default 'mapped'
    check (location_precision in ('surveyed','mapped','approximate','regional')),
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high','operator_confirmed')),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(source_id, source_record_id)
);

create table public.canonical_grid_lines (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_artifact_id uuid references public.grid_source_artifacts(id) on delete set null,
  source_record_id text not null,
  name text,
  operator_name text,
  voltage_kv numeric[] not null default '{}',
  circuits integer check (circuits is null or circuits > 0),
  underground boolean not null default false,
  geometry extensions.geometry(MultiLineString, 4326) not null,
  operational_status text not null default 'unknown'
    check (operational_status in ('operational','construction','planned','out_of_service','unknown')),
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high','operator_confirmed')),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(source_id, source_record_id)
);

create table public.canonical_industrial_sites (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_artifact_id uuid references public.grid_source_artifacts(id) on delete set null,
  source_record_id text not null,
  name text,
  site_kind text not null
    check (site_kind in ('industrial_land','warehouse','manufacturing','works','unknown')),
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  area_ha numeric check (area_ha is null or area_ha >= 0),
  planning_status text not null default 'screening_only'
    check (planning_status in ('screening_only','official_industrial_zone','zoning_verified','unknown')),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(source_id, source_record_id)
);

create table public.public_capacity_observations (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.canonical_grid_nodes(id) on delete cascade,
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_artifact_id uuid references public.grid_source_artifacts(id) on delete set null,
  source_record_id text not null,
  direction text not null check (direction in ('demand','generation')),
  observation_type text not null
    check (observation_type in ('published_exact','published_band','feasible_no_mw','unavailable','document_derived','model_estimate')),
  exact_mw numeric check (exact_mw is null or exact_mw >= 0),
  band_min_mw numeric check (band_min_mw is null or band_min_mw >= 0),
  band_max_mw numeric check (band_max_mw is null or band_max_mw >= 0),
  voltage_kv numeric check (voltage_kv is null or voltage_kv > 0),
  valid_at timestamptz,
  published_at timestamptz,
  confidence_grade text not null check (confidence_grade in ('A','B','C','D','E','U')),
  caveats text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_id, source_record_id),
  check (
    (observation_type = 'published_exact' and exact_mw is not null)
    or (observation_type = 'published_band' and band_min_mw is not null)
    or observation_type not in ('published_exact','published_band')
  ),
  check (band_max_mw is null or band_min_mw is null or band_max_mw >= band_min_mw)
);

alter table public.network_nodes
  add column if not exists canonical_node_id uuid references public.canonical_grid_nodes(id) on delete set null;

alter table public.candidate_sites
  add column if not exists canonical_industrial_site_id uuid references public.canonical_industrial_sites(id) on delete set null;

create index canonical_grid_nodes_geometry_idx on public.canonical_grid_nodes using gist (geometry);
create index canonical_grid_lines_geometry_idx on public.canonical_grid_lines using gist (geometry);
create index canonical_industrial_sites_geometry_idx on public.canonical_industrial_sites using gist (geometry);
create index public_capacity_observations_node_idx
  on public.public_capacity_observations(node_id, published_at desc nulls last);
create index network_nodes_canonical_idx on public.network_nodes(canonical_node_id)
  where canonical_node_id is not null;
create index candidate_sites_canonical_industrial_idx on public.candidate_sites(canonical_industrial_site_id)
  where canonical_industrial_site_id is not null;

alter table public.grid_sources enable row level security;
alter table public.grid_source_artifacts enable row level security;
alter table public.canonical_grid_nodes enable row level security;
alter table public.canonical_grid_lines enable row level security;
alter table public.canonical_industrial_sites enable row level security;
alter table public.public_capacity_observations enable row level security;

create policy "authenticated users read grid source metadata"
  on public.grid_sources for select to authenticated using (true);
create policy "authenticated users read active source artifacts"
  on public.grid_source_artifacts for select to authenticated using (status = 'active');
create policy "authenticated users read canonical nodes"
  on public.canonical_grid_nodes for select to authenticated using (true);
create policy "authenticated users read canonical lines"
  on public.canonical_grid_lines for select to authenticated using (true);
create policy "authenticated users read canonical industrial sites"
  on public.canonical_industrial_sites for select to authenticated using (true);
create policy "authenticated users read public capacity observations"
  on public.public_capacity_observations for select to authenticated using (true);

comment on table public.canonical_grid_nodes is
  'Reusable public grid context. A row is not a project connection point or proof of available capacity.';
comment on table public.public_capacity_observations is
  'Immutable public capacity evidence. Demand, generation, and non-numeric feasibility remain explicitly classified.';

