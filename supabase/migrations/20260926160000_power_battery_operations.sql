-- Battery-specific extension of the existing Power Operations foundation.
-- Facility observations remain in operations_measurements; this migration does not duplicate them.

create table if not exists public.operations_battery_assets (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null,
  usable_energy_mwh numeric not null check (usable_energy_mwh >= 0),
  maximum_discharge_mw numeric not null check (maximum_discharge_mw >= 0),
  maximum_charge_mw numeric not null check (maximum_charge_mw >= 0),
  minimum_soc_percent numeric not null check (minimum_soc_percent between 0 and 100),
  maximum_soc_percent numeric not null check (maximum_soc_percent between 0 and 100),
  charge_efficiency numeric not null check (charge_efficiency > 0 and charge_efficiency <= 1),
  discharge_efficiency numeric not null check (discharge_efficiency > 0 and discharge_efficiency <= 1),
  state_of_health_percent numeric check (state_of_health_percent > 0 and state_of_health_percent <= 100),
  source_id uuid references public.operations_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (minimum_soc_percent <= maximum_soc_percent)
);

create table if not exists public.operations_dispatch_intervals (
  id bigint generated always as identity primary key,
  recommendation_id uuid not null references public.operations_recommendations(id) on delete cascade,
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  event_at timestamptz not null,
  facility_demand_mw numeric not null check (facility_demand_mw >= 0),
  target_import_mw numeric not null check (target_import_mw >= 0),
  recommended_battery_mw numeric not null,
  expected_grid_import_mw numeric not null check (expected_grid_import_mw >= 0),
  expected_soc_percent numeric check (expected_soc_percent between 0 and 100),
  residual_shortfall_mw numeric not null default 0 check (residual_shortfall_mw >= 0),
  constraint_code text not null default 'none',
  evidence_class text not null check (evidence_class in ('measured','user_assumption','calculated','simulated','unavailable')),
  created_at timestamptz not null default now(),
  unique (recommendation_id, event_at)
);

create table if not exists public.operations_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  battery_asset_id uuid references public.operations_battery_assets(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  started_at timestamptz not null,
  ended_at timestamptz,
  event_type text not null check (event_type in ('observed_charge','observed_discharge','shadow_recommendation','operator_note')),
  peak_power_mw numeric,
  energy_mwh numeric,
  source_id uuid references public.operations_sources(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.operations_imports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_id uuid references public.operations_sources(id) on delete set null,
  file_name text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  record_count integer not null check (record_count >= 0),
  accepted_count integer not null check (accepted_count >= 0),
  rejected_count integer not null check (rejected_count >= 0),
  storage_object_path text,
  imported_at timestamptz not null default now(),
  unique (facility_id, content_sha256)
);

create table if not exists public.operations_data_quality (
  id bigint generated always as identity primary key,
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_id uuid references public.operations_sources(id) on delete cascade,
  assessed_at timestamptz not null default now(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  completeness_percent numeric not null check (completeness_percent between 0 and 100),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  missing_count integer not null default 0 check (missing_count >= 0),
  stale_count integer not null default 0 check (stale_count >= 0),
  status text not null check (status in ('accepted','warning','rejected')),
  details jsonb not null default '{}'::jsonb,
  check (window_end >= window_start)
);

create index if not exists operations_dispatch_intervals_lookup_idx on public.operations_dispatch_intervals(facility_id, event_at desc);
create index if not exists operations_dispatch_events_lookup_idx on public.operations_dispatch_events(facility_id, started_at desc);

alter table public.operations_battery_assets enable row level security;
alter table public.operations_dispatch_intervals enable row level security;
alter table public.operations_dispatch_events enable row level security;
alter table public.operations_imports enable row level security;
alter table public.operations_data_quality enable row level security;

create policy "owners manage battery assets" on public.operations_battery_assets for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners read dispatch intervals" on public.operations_dispatch_intervals for select to authenticated using (owner_id=auth.uid());
create policy "owners read dispatch events" on public.operations_dispatch_events for select to authenticated using (owner_id=auth.uid());
create policy "owners read operations imports" on public.operations_imports for select to authenticated using (owner_id=auth.uid());
create policy "owners read operations data quality" on public.operations_data_quality for select to authenticated using (owner_id=auth.uid());

grant select on public.operations_battery_assets, public.operations_dispatch_intervals, public.operations_dispatch_events, public.operations_imports, public.operations_data_quality to authenticated;
grant insert, update, delete on public.operations_battery_assets to authenticated;

comment on table public.operations_dispatch_intervals is 'Read-only shadow dispatch calculations. Positive battery MW means discharge and negative means charge.';
comment on table public.operations_imports is 'Import metadata only; raw evidence belongs in private object storage and normalized records in operations_measurements.';
