-- Release D1: provenance, public-context ingestion and licensed observation controls.
-- Public sources remain screening context. No row in these tables establishes
-- connection capacity unless its validation class and operator gate say so.

create table if not exists public.power_finder_source_registry (
  source_key text primary key,
  publisher text not null,
  dataset_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  licence_name text not null,
  reuse_status text not null check (reuse_status in ('permitted','permission_required','link_only','operator_contract')),
  evidence_type text not null check (evidence_type in ('observed','registered','mapped','published_indicative','synthetic','operator_provided')),
  spatial_resolution text not null,
  temporal_resolution text,
  evidence_boundary text not null,
  last_successful_ingestion_at timestamptz,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.power_finder_source_registry
  (source_key,publisher,dataset_name,source_url,licence_name,reuse_status,evidence_type,spatial_resolution,temporal_resolution,evidence_boundary)
values
  ('osm-power','OpenStreetMap contributors','OSM power and industrial mapping','https://www.openstreetmap.org/copyright','ODbL 1.0','permitted','mapped','feature geometry',null,'Mapped infrastructure; not an electrical model or capacity.'),
  ('bnetza-mastr-asset-context','Bundesnetzagentur','Marktstammdatenregister','https://www.marktstammdatenregister.de/MaStR/Datendownload','MaStR public-data terms','permitted','registered','asset or administrative area','event dated','Registered assets; not dispatch, loading or headroom.'),
  ('bnetza-smard-grid-load','Bundesnetzagentur / SMARD','Actual grid load','https://www.smard.de/en/datennutzung','CC BY 4.0','permitted','observed','Germany or published zone','hourly','System context; not feeder or substation loading.'),
  ('bnetza-smard-day-ahead-price','Bundesnetzagentur / SMARD','Day-ahead electricity price','https://www.smard.de/en/datennutzung','CC BY 4.0','permitted','observed','German bidding zone','hourly','Market context; not grid capacity.'),
  ('bnetza-smard-wind-onshore','Bundesnetzagentur / SMARD','Onshore wind generation','https://www.smard.de/en/datennutzung','CC BY 4.0','permitted','observed','Germany or published zone','hourly','System generation context; not local loading.'),
  ('bnetza-smard-wind-offshore','Bundesnetzagentur / SMARD','Offshore wind generation','https://www.smard.de/en/datennutzung','CC BY 4.0','permitted','observed','Germany or published zone','hourly','System generation context; not local loading.'),
  ('bnetza-smard-solar-generation','Bundesnetzagentur / SMARD','Solar generation','https://www.smard.de/en/datennutzung','CC BY 4.0','permitted','observed','Germany or published zone','hourly','System generation context; not local loading.'),
  ('bnetza-smard-load-forecast','Bundesnetzagentur / SMARD','Load forecast','https://www.smard.de/en/datennutzung','CC BY 4.0','permitted','observed','Germany or published zone','hourly','System forecast context; not local loading.'),
  ('dwd-cdc-hourly-temperature','Deutscher Wetterdienst','CDC hourly weather observations','https://opendata.dwd.de/climate_environment/CDC/','DWD open-data terms','permitted','observed','weather station','hourly','Weather observations; not network loading or capacity.'),
  ('netztransparenz-redispatch','German transmission system operators','Redispatch measures','https://www.netztransparenz.de/de-de/Systemdienstleistungen/Betriebsfuehrung/Redispatch','publisher terms','permitted','observed','as published','measure interval','Congestion context; not node headroom.'),
  ('50hertz-indicative-capacity','50Hertz Transmission GmbH','Indicative grid-connection capacity map','https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss','permission not established','permission_required','published_indicative','published connection point',null,'Non-binding published indication; values may not be copied until reuse permission is recorded.'),
  ('simbench','SimBench consortium','Representative German benchmark networks','https://simbench.de/en/','SimBench terms','permitted','synthetic','representative benchmark network','profile interval','Synthetic benchmark; not geographically real capacity.')
on conflict (source_key) do update set
  publisher=excluded.publisher,dataset_name=excluded.dataset_name,source_url=excluded.source_url,
  licence_name=excluded.licence_name,reuse_status=excluded.reuse_status,evidence_type=excluded.evidence_type,
  spatial_resolution=excluded.spatial_resolution,temporal_resolution=excluded.temporal_resolution,
  evidence_boundary=excluded.evidence_boundary,updated_at=now();

create table if not exists public.power_finder_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.power_finder_source_registry(source_key),
  run_key text not null,
  status text not null check (status in ('started','staged','accepted','failed','superseded')),
  started_at timestamptz not null,
  completed_at timestamptz,
  artifact_sha256 text check (artifact_sha256 is null or artifact_sha256 ~ '^[0-9a-f]{64}$'),
  record_count integer check (record_count is null or record_count >= 0),
  raw_object_path text,
  error_summary text,
  quality_summary jsonb not null default '{}'::jsonb,
  unique(source_key,run_key)
);

create table if not exists public.power_finder_calculation_manifests (
  id uuid primary key default gen_random_uuid(),
  calculation_key text not null,
  calculation_version text not null,
  validation_class text not null check (validation_class in ('public_screening','synthetic_demonstration','operator_model_unvalidated','operator_model_reconciled','operator_reviewed','operator_confirmed')),
  input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
  source_release_ids uuid[] not null default '{}',
  model_version_id uuid references public.grid_model_versions(id) on delete restrict,
  solver text,
  solver_version text,
  solver_configuration jsonb not null default '{}'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null,
  unique(calculation_key,calculation_version,input_sha256)
);

create table if not exists public.redispatch_context_events (
  id uuid primary key default gen_random_uuid(),
  source_release_id uuid not null references public.power_finder_ingestion_runs(id) on delete restrict,
  source_record_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  operator_name text,
  direction text,
  volume_mwh numeric,
  reason text,
  region_label text,
  source_url text not null check (source_url ~ '^https://'),
  properties jsonb not null default '{}'::jsonb,
  unique(source_release_id,source_record_id)
);

alter table public.public_capacity_observations
  add column if not exists source_key text references public.power_finder_source_registry(source_key),
  add column if not exists direction text check (direction is null or direction in ('import','export','generation','bidirectional')),
  add column if not exists validity_status text not null default 'current' check (validity_status in ('current','stale','withdrawn')),
  add column if not exists reuse_evidence jsonb not null default '{}'::jsonb,
  add column if not exists non_binding boolean not null default true;

create or replace function public.enforce_capacity_observation_reuse()
returns trigger language plpgsql set search_path='' as $$
declare source_status text;
begin
  if new.source_key is null then raise exception 'capacity observation requires source_key'; end if;
  select reuse_status into source_status from public.power_finder_source_registry where source_key=new.source_key;
  if source_status not in ('permitted','operator_contract') then
    raise exception 'source % is not approved for value reuse', new.source_key;
  end if;
  if new.non_binding=false and coalesce(new.reuse_evidence->>'operator_confirmation_id','')='' then
    raise exception 'binding observation requires operator confirmation evidence';
  end if;
  return new;
end $$;

drop trigger if exists capacity_observation_reuse_gate on public.public_capacity_observations;
create trigger capacity_observation_reuse_gate before insert or update on public.public_capacity_observations
for each row execute function public.enforce_capacity_observation_reuse();

alter table public.power_finder_source_registry enable row level security;
alter table public.power_finder_ingestion_runs enable row level security;
alter table public.power_finder_calculation_manifests enable row level security;
alter table public.redispatch_context_events enable row level security;
revoke all on public.power_finder_source_registry,public.power_finder_ingestion_runs,
  public.power_finder_calculation_manifests,public.redispatch_context_events from anon,authenticated;

create or replace function public.power_finder_public_source_health()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceKey',s.source_key,'publisher',s.publisher,'datasetName',s.dataset_name,
    'sourceUrl',s.source_url,'licence',s.licence_name,'reuseStatus',s.reuse_status,
    'evidenceType',s.evidence_type,'spatialResolution',s.spatial_resolution,
    'temporalResolution',s.temporal_resolution,'evidenceBoundary',s.evidence_boundary,
    'lastSuccessfulIngestionAt',s.last_successful_ingestion_at,
    'lastRunStatus',r.status,'lastRunRecordCount',r.record_count
  ) order by s.source_key),'[]'::jsonb)
  from public.power_finder_source_registry s
  left join lateral (
    select status,record_count from public.power_finder_ingestion_runs i
    where i.source_key=s.source_key order by i.started_at desc limit 1
  ) r on true where s.enabled;
$$;
revoke all on function public.power_finder_public_source_health() from public;
grant execute on function public.power_finder_public_source_health() to anon,authenticated;
