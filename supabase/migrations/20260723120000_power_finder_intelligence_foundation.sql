-- Power Finder intelligence foundation: authoritative assets, identity review,
-- site-to-node metrics, operator knowledge and user-owned shortlists.

create table public.grid_operators (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  operator_type text not null check (operator_type in ('tso','dso','closed_distribution','unknown')),
  country_code text not null default 'DE',
  aliases text[] not null default '{}',
  website_url text,
  connection_url text,
  capacity_source_url text,
  evidence_class text not null default 'official_public'
    check (evidence_class in ('official_operator','official_regulatory','official_public','open_mapping')),
  source_id text references public.grid_sources(id) on delete set null,
  service_area extensions.geometry(MultiPolygon, 4326),
  metadata jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canonical_grid_nodes
  add column if not exists operator_id uuid references public.grid_operators(id) on delete set null,
  add column if not exists municipality text,
  add column if not exists postcode text,
  add column if not exists federal_state text,
  add column if not exists identity_status text not null default 'unresolved'
    check (identity_status in ('unresolved','candidate','reviewed','operator_confirmed')),
  add column if not exists identity_confidence numeric not null default 0
    check (identity_confidence between 0 and 1);

create table public.grid_node_identity_reviews (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.canonical_grid_nodes(id) on delete cascade,
  candidate_node_id uuid references public.canonical_grid_nodes(id) on delete cascade,
  proposed_name text,
  proposed_operator_id uuid references public.grid_operators(id) on delete set null,
  match_method text not null,
  match_distance_m numeric check (match_distance_m is null or match_distance_m >= 0),
  voltage_overlap boolean,
  confidence numeric not null check (confidence between 0 and 1),
  status text not null default 'proposed'
    check (status in ('proposed','accepted','rejected','superseded')),
  evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (candidate_node_id is null or candidate_node_id <> node_id)
);

create table public.canonical_energy_assets (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_artifact_id uuid references public.grid_source_artifacts(id) on delete set null,
  source_record_id text not null,
  asset_type text not null
    check (asset_type in ('generation','storage','consumption','hybrid','unknown')),
  technology text,
  canonical_name text,
  operator_name text,
  grid_operator_name text,
  net_capacity_mw numeric check (net_capacity_mw is null or net_capacity_mw >= 0),
  storage_energy_mwh numeric check (storage_energy_mwh is null or storage_energy_mwh >= 0),
  operational_status text not null default 'unknown'
    check (operational_status in ('operational','construction','planned','out_of_service','unknown')),
  commissioning_date date,
  municipality text,
  postcode text,
  federal_state text,
  geometry extensions.geometry(Point, 4326),
  location_precision text not null default 'regional'
    check (location_precision in ('surveyed','mapped','postcode','municipality','regional','withheld')),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(source_id, source_record_id)
);

create table public.grid_node_asset_context (
  node_id uuid not null references public.canonical_grid_nodes(id) on delete cascade,
  radius_km integer not null check (radius_km in (5,10,20,50)),
  generation_mw numeric not null default 0,
  storage_mw numeric not null default 0,
  storage_mwh numeric not null default 0,
  operational_asset_count integer not null default 0,
  planned_asset_count integer not null default 0,
  technology_mix jsonb not null default '{}'::jsonb,
  source_release_ids uuid[] not null default '{}',
  calculated_at timestamptz not null default now(),
  primary key (node_id, radius_km)
);

create table public.site_node_metrics (
  site_id uuid not null references public.canonical_industrial_sites(id) on delete cascade,
  node_id uuid not null references public.canonical_grid_nodes(id) on delete cascade,
  straight_line_distance_km numeric not null check (straight_line_distance_km >= 0),
  indicative_route_distance_km numeric check (
    indicative_route_distance_km is null or indicative_route_distance_km >= straight_line_distance_km
  ),
  voltage_compatibility text not null default 'unknown'
    check (voltage_compatibility in ('compatible','conditional','incompatible','unknown')),
  context_score integer not null default 0 check (context_score between 0 and 100),
  evidence_score integer not null default 0 check (evidence_score between 0 and 100),
  constraints_score integer check (constraints_score is null or constraints_score between 0 and 100),
  missing_evidence text[] not null default '{}',
  calculation_version text not null,
  calculated_at timestamptz not null default now(),
  primary key (site_id, node_id)
);

create table public.power_finder_shortlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid references public.canonical_industrial_sites(id) on delete set null,
  node_id uuid references public.canonical_grid_nodes(id) on delete set null,
  source_feature_id text,
  feature_kind text check (
    feature_kind is null or feature_kind in ('node','industrial_site','generation_asset','storage_asset')
  ),
  assessment_site_id uuid references public.candidate_sites(id) on delete set null,
  title text not null,
  status text not null default 'screening'
    check (status in ('screening','investigating','operator_contacted','shortlisted','rejected')),
  notes text,
  assumptions jsonb not null default '{}'::jsonb,
  decision_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (site_id is not null or node_id is not null or source_feature_id is not null)
);

create index grid_operators_service_area_idx on public.grid_operators using gist (service_area);
create index canonical_grid_nodes_operator_idx on public.canonical_grid_nodes(operator_id);
create index canonical_grid_nodes_identity_idx
  on public.canonical_grid_nodes(identity_status, identity_confidence desc);
create index grid_node_identity_reviews_node_idx
  on public.grid_node_identity_reviews(node_id, status, confidence desc);
create index canonical_energy_assets_geometry_idx on public.canonical_energy_assets using gist (geometry);
create index canonical_energy_assets_type_status_idx
  on public.canonical_energy_assets(asset_type, operational_status);
create index canonical_energy_assets_operator_idx on public.canonical_energy_assets(grid_operator_name);
create index site_node_metrics_node_distance_idx
  on public.site_node_metrics(node_id, straight_line_distance_km);
create index power_finder_shortlists_user_idx
  on public.power_finder_shortlists(user_id, updated_at desc);

alter table public.grid_operators enable row level security;
alter table public.grid_node_identity_reviews enable row level security;
alter table public.canonical_energy_assets enable row level security;
alter table public.grid_node_asset_context enable row level security;
alter table public.site_node_metrics enable row level security;
alter table public.power_finder_shortlists enable row level security;

create policy "authenticated users read operator directory"
  on public.grid_operators for select to authenticated using (true);
create policy "authenticated users read accepted identity evidence"
  on public.grid_node_identity_reviews for select to authenticated using (status = 'accepted');
create policy "authenticated users read energy assets"
  on public.canonical_energy_assets for select to authenticated using (true);
create policy "authenticated users read node asset context"
  on public.grid_node_asset_context for select to authenticated using (true);
create policy "authenticated users read site node metrics"
  on public.site_node_metrics for select to authenticated using (true);
create policy "users manage their own power finder shortlists"
  on public.power_finder_shortlists for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.canonical_energy_assets is
  'Public registered asset context. Asset capacity is not available grid connection capacity.';
comment on table public.site_node_metrics is
  'Explainable screening metrics. Unknown evidence must remain explicit and must not be treated as zero.';
