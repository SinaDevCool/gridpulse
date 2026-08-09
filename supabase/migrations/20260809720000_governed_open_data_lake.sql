-- Immutable artefacts, rollback pointers and operator crosswalk for governed open sources.
alter table public.power_finder_ingestion_runs
  add column if not exists parser_version text,
  add column if not exists licence_verified_at timestamptz,
  add column if not exists geographic_coverage jsonb not null default '{}'::jsonb,
  add column if not exists temporal_coverage jsonb not null default '{}'::jsonb,
  add column if not exists previous_accepted_release_id uuid references public.power_finder_ingestion_runs(id),
  add column if not exists evidence_origin text not null default 'official_open'
    check (evidence_origin in ('official_open','open_benchmark','operator_supplied',
      'customer_declared','synthetic_fixture','derived'));

create table if not exists public.power_finder_raw_artifacts (
  artifact_sha256 text primary key check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  source_key text not null references public.power_finder_source_registry(source_key),
  object_path text not null unique,
  byte_count bigint not null check (byte_count > 0),
  content_type text not null,
  publisher text not null,
  source_url text not null check (source_url ~ '^https://'),
  licence_name text not null,
  retrieved_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.power_finder_ingestion_quarantine (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.power_finder_source_registry(source_key),
  run_key text not null,
  artifact_sha256 text,
  safe_error_code text not null,
  stage text not null,
  details jsonb not null default '{}'::jsonb,
  quarantined_at timestamptz not null default now(),
  unique(source_key, run_key, safe_error_code)
);

create table if not exists public.power_finder_operator_crosswalk (
  id uuid primary key default gen_random_uuid(),
  source_release_id uuid not null references public.power_finder_ingestion_runs(id),
  operator_name text not null,
  region_code text not null,
  geometry extensions.geography(multipolygon, 4326),
  match_method text not null,
  confidence numeric not null check (confidence between 0 and 1),
  source_url text not null check (source_url ~ '^https://'),
  capacity_claim boolean not null default false check (capacity_claim = false),
  unique(source_release_id, operator_name, region_code)
);

insert into public.power_finder_source_registry
  (source_key,publisher,dataset_name,source_url,licence_name,reuse_status,evidence_type,
   spatial_resolution,temporal_resolution,evidence_boundary)
values
  ('entsoe-transparency-context','ENTSO-E','Transparency Platform selected context',
   'https://transparency.entsoe.eu/','ENTSO-E Transparency Platform terms','permitted',
   'observed','published bidding zone or asset','published interval',
   'European system context; not German nodal loading or available capacity.'),
  ('vnbdigital-operator-crosswalk','VNBdigital','Network operator area and planning catalogue',
   'https://www.vnbdigital.de/','publisher terms','permitted','registered',
   'published operator coverage','release dated',
   'Likely operator identity and published planning context; not asset ownership or capacity.')
on conflict (source_key) do update set
  publisher=excluded.publisher,dataset_name=excluded.dataset_name,source_url=excluded.source_url,
  licence_name=excluded.licence_name,reuse_status=excluded.reuse_status,
  evidence_type=excluded.evidence_type,spatial_resolution=excluded.spatial_resolution,
  temporal_resolution=excluded.temporal_resolution,evidence_boundary=excluded.evidence_boundary,
  updated_at=now();

alter table public.power_finder_raw_artifacts enable row level security;
alter table public.power_finder_ingestion_quarantine enable row level security;
alter table public.power_finder_operator_crosswalk enable row level security;
revoke all on public.power_finder_raw_artifacts,public.power_finder_ingestion_quarantine,
  public.power_finder_operator_crosswalk from anon,authenticated;
