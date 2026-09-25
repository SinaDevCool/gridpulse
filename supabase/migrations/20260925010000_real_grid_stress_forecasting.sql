-- Real-data-only day-ahead grid-stress forecasting.

create table if not exists public.grid_context_metrics (
  metric_key text primary key,
  display_name text not null,
  canonical_unit text not null,
  source_key text not null references public.power_finder_source_registry(source_key),
  value_kind text not null check (value_kind in ('observed', 'forecast')),
  mandatory boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.grid_forecast_regions (
  region_code text primary key,
  display_name text not null,
  bidding_zone text,
  geometry extensions.geometry(MultiPolygon, 4326),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.grid_context_observations (
  id bigint generated always as identity primary key,
  region_code text not null references public.grid_forecast_regions(region_code),
  metric_key text not null references public.grid_context_metrics(metric_key),
  interval_start timestamptz not null,
  interval_end timestamptz not null,
  issued_at timestamptz,
  value numeric not null,
  unit text not null,
  source_key text not null references public.power_finder_source_registry(source_key),
  source_record_id text,
  source_url text not null,
  retrieved_at timestamptz not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  quality_flags text[] not null default '{}',
  raw_artifact_uri text,
  created_at timestamptz not null default now(),
  check (interval_end > interval_start),
  check (issued_at is null or issued_at <= retrieved_at),
  unique(region_code, metric_key, interval_start, issued_at, source_key)
);
create index if not exists grid_context_observations_lookup
  on public.grid_context_observations(region_code, metric_key, interval_start desc);
create unique index if not exists grid_context_observations_no_issue_unique
  on public.grid_context_observations(region_code, metric_key, interval_start, source_key)
  where issued_at is null;

create table if not exists public.grid_stress_targets (
  region_code text not null references public.grid_forecast_regions(region_code),
  delivery_day date not null,
  redispatch_mwh numeric not null check (redispatch_mwh >= 0),
  event_count integer not null check (event_count >= 0),
  coverage_complete boolean not null,
  source_release_ids uuid[] not null default '{}',
  built_at timestamptz not null default now(),
  primary key(region_code, delivery_day)
);

create table if not exists public.forecast_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.grid_forecast_regions(region_code),
  issue_time timestamptz not null,
  delivery_day date not null,
  schema_version text not null,
  features jsonb not null,
  source_observation_ids bigint[] not null,
  source_evidence_types text[] not null,
  completeness numeric not null check (completeness between 0 and 1),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique(region_code, issue_time, delivery_day, schema_version),
  check (not (source_evidence_types && array['synthetic','scenario','surrogate','reconstructed_network']))
);

create table if not exists public.forecast_model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  version text not null,
  target_definition jsonb not null,
  feature_schema_version text not null,
  training_cutoff timestamptz not null,
  artifact_uri text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  metrics jsonb not null,
  promotion_status text not null default 'candidate'
    check (promotion_status in ('candidate','accepted','rejected','retired')),
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(model_name, version)
);

create unique index if not exists one_accepted_grid_stress_model
  on public.forecast_model_versions(model_name) where promotion_status = 'accepted';

create table if not exists public.forecast_backtest_folds (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.forecast_model_versions(id) on delete cascade,
  fold_index integer not null,
  train_start date not null,
  train_end date not null,
  test_start date not null,
  test_end date not null,
  threshold_mwh numeric not null,
  metrics jsonb not null,
  leakage_checks jsonb not null,
  created_at timestamptz not null default now(),
  unique(model_version_id, fold_index),
  check (train_start <= train_end and train_end < test_start and test_start <= test_end)
);

create table if not exists public.grid_stress_predictions (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.grid_forecast_regions(region_code),
  issue_time timestamptz not null,
  delivery_day date not null,
  model_version_id uuid not null references public.forecast_model_versions(id),
  feature_snapshot_id uuid not null references public.forecast_feature_snapshots(id),
  high_stress_probability numeric not null check (high_stress_probability between 0 and 1),
  redispatch_mwh_p50 numeric not null check (redispatch_mwh_p50 >= 0),
  redispatch_mwh_p90 numeric not null check (redispatch_mwh_p90 >= redispatch_mwh_p50),
  severity text not null check (severity in ('low','moderate','high','critical')),
  confidence text not null check (confidence in ('high','medium','low','unavailable')),
  drivers jsonb not null default '[]',
  caveats text[] not null default '{}',
  source_freshness jsonb not null,
  status text not null default 'published' check (status in ('published','superseded','withdrawn')),
  created_at timestamptz not null default now(),
  unique(region_code, issue_time, delivery_day)
);
create index if not exists grid_stress_predictions_current
  on public.grid_stress_predictions(region_code, delivery_day desc, issue_time desc)
  where status = 'published';

create table if not exists public.forecast_monitoring_events (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid references public.forecast_model_versions(id) on delete set null,
  region_code text not null references public.grid_forecast_regions(region_code),
  checked_at timestamptz not null,
  check_type text not null check (check_type in ('freshness','feature_drift','calibration','realized_performance')),
  status text not null check (status in ('passed','warning','failed')),
  metrics jsonb not null,
  action_taken text,
  created_at timestamptz not null default now()
);

alter table public.grid_context_metrics enable row level security;
alter table public.grid_forecast_regions enable row level security;
alter table public.grid_context_observations enable row level security;
alter table public.grid_stress_targets enable row level security;
alter table public.forecast_feature_snapshots enable row level security;
alter table public.forecast_model_versions enable row level security;
alter table public.forecast_backtest_folds enable row level security;
alter table public.grid_stress_predictions enable row level security;
alter table public.forecast_monitoring_events enable row level security;

insert into public.grid_forecast_regions(region_code, display_name, bidding_zone)
values ('DE', 'Germany', '10Y1001A1001A82H') on conflict (region_code) do nothing;

-- Registry rows are explicit so a metric cannot silently switch provider.
insert into public.power_finder_source_registry
  (source_key,publisher,dataset_name,source_url,licence_name,reuse_status,evidence_type,spatial_resolution,temporal_resolution,evidence_boundary,enabled)
values
  ('entsoe-transparency','ENTSO-E','Transparency Platform','https://transparency.entsoe.eu/','ENTSO-E terms','permitted','observed','bidding zone or border','15-60 minutes','System and cross-border context; not local capacity.',true),
  ('dwd-open-forecast','Deutscher Wetterdienst','Open numerical weather forecast','https://opendata.dwd.de/weather/nwp/','GeoNutzV-DE','permitted','observed','weather grid','forecast cycle','Weather forecast captured before delivery; not grid capacity.',true)
on conflict (source_key) do update set enabled = excluded.enabled;

insert into public.grid_context_metrics(metric_key, display_name, canonical_unit, source_key, value_kind, mandatory)
values
  ('actual_load_mw','Actual load','MW','bnetza-smard-grid-load','observed',true),
  ('load_forecast_mw','Day-ahead load forecast','MW','bnetza-smard-load-forecast','forecast',true),
  ('wind_generation_mw','Wind generation','MW','bnetza-smard-wind-onshore','observed',true),
  ('solar_generation_mw','Solar generation','MW','bnetza-smard-solar-generation','observed',true),
  ('day_ahead_price_eur_mwh','Day-ahead price','EUR/MWh','bnetza-smard-day-ahead-price','observed',false),
  ('redispatch_energy_mwh','Redispatch energy','MWh','netztransparenz-redispatch','observed',true),
  ('cross_border_flow_mw','Cross-border physical flow','MW','entsoe-transparency','observed',false),
  ('temperature_forecast_c','Temperature forecast','degC','dwd-open-forecast','forecast',false),
  ('wind_speed_forecast_ms','Wind-speed forecast','m/s','dwd-open-forecast','forecast',false)
on conflict (metric_key) do nothing;

alter table public.analytics_jobs drop constraint if exists analytics_jobs_job_type_check;
alter table public.analytics_jobs add constraint analytics_jobs_job_type_check check (job_type in (
  'operator_source_health','profile_validation','corridor_ranking','activation_scenario',
  'network_simulation','reference_topology','flexibility_optimization','synthetic_capacity',
  'release_b_network','c1_network_study','c2_hourly_capacity','c3_security_flexibility',
  'c4_reconciliation','p0_p4_permutation','release3_shadow_validation','graph_guided_study',
  'capacity_requirement','facility_plan','facility_uncertainty','facility_historical_replay',
  'operator_enquiry_package','shadow_verification','fca_interval','market_qualification',
  'rolling_facility_plan','grid_stress_ingestion','grid_stress_backtest','grid_stress_inference'
));

create or replace function public.grid_stress_public_current(p_region_code text default 'DE')
returns table(payload jsonb)
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'schemaVersion','gridpulse-grid-stress-public-v1',
    'status','available',
    'regionCode',p.region_code,
    'regionName',r.display_name,
    'issueTime',p.issue_time,
    'deliveryDay',p.delivery_day,
    'highStressProbability',p.high_stress_probability,
    'redispatchMwhP50',p.redispatch_mwh_p50,
    'redispatchMwhP90',p.redispatch_mwh_p90,
    'severity',p.severity,
    'confidence',p.confidence,
    'drivers',p.drivers,
    'caveats',p.caveats,
    'sourceFreshness',p.source_freshness,
    'model',jsonb_build_object('name',m.model_name,'version',m.version,'trainingCutoff',m.training_cutoff),
    'decisionBoundary','Regional public-data forecast; not available connection capacity or an operator offer.'
  )
  from public.grid_stress_predictions p
  join public.grid_forecast_regions r on r.region_code=p.region_code
  join public.forecast_model_versions m on m.id=p.model_version_id
  where p.region_code=p_region_code and p.status='published' and m.promotion_status='accepted'
  order by p.delivery_day desc,p.issue_time desc limit 1;
$$;
grant execute on function public.grid_stress_public_current(text) to anon, authenticated;

create or replace function public.promote_grid_stress_model(p_model_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare fold_count integer;
declare failed_gate_count integer;
begin
  select count(*), count(*) filter (where
    coalesce((metrics->'candidate'->>'brier')::numeric, 1) >= least(
      coalesce((metrics->'baselines'->'seasonal'->>'brier')::numeric, 0),
      coalesce((metrics->'baselines'->'persistence'->>'brier')::numeric, 0),
      coalesce((metrics->'baselines'->'logistic'->>'brier')::numeric, 0))
    or coalesce((metrics->'candidate'->>'log_loss')::numeric, 99) >= least(
      coalesce((metrics->'baselines'->'seasonal'->>'log_loss')::numeric, 0),
      coalesce((metrics->'baselines'->'persistence'->>'log_loss')::numeric, 0),
      coalesce((metrics->'baselines'->'logistic'->>'log_loss')::numeric, 0))
    or coalesce((leakage_checks->>'chronological')::boolean, false) = false
  ) into fold_count, failed_gate_count
  from public.forecast_backtest_folds where model_version_id=p_model_id;
  if fold_count < 3 or failed_gate_count > 0 then
    raise exception 'model cannot be promoted: % folds, % failed gates', fold_count, failed_gate_count;
  end if;
  update public.forecast_model_versions set promotion_status='retired'
    where model_name=(select model_name from public.forecast_model_versions where id=p_model_id)
      and promotion_status='accepted' and id<>p_model_id;
  update public.forecast_model_versions set promotion_status='accepted',promoted_at=now()
    where id=p_model_id and promotion_status='candidate';
  if not found then raise exception 'candidate model not found'; end if;
end $$;
revoke all on function public.promote_grid_stress_model(uuid) from public, anon, authenticated;

create or replace function public.reject_non_real_forecast_inputs()
returns trigger language plpgsql as $$
begin
  if new.source_evidence_types && array['synthetic','scenario','surrogate','reconstructed_network'] then
    raise exception 'Production forecasts accept observed/public-forecast inputs only';
  end if;
  return new;
end $$;
drop trigger if exists reject_non_real_forecast_inputs on public.forecast_feature_snapshots;
create trigger reject_non_real_forecast_inputs before insert or update on public.forecast_feature_snapshots
for each row execute function public.reject_non_real_forecast_inputs();
