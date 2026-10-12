-- Real-data-only Power Operations foundation. Simulation data remains isolated in operations_simulations.

create table if not exists public.operations_facilities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 160),
  timezone text not null default 'Europe/Berlin',
  contracted_import_limit_mw numeric check (contracted_import_limit_mw > 0),
  limit_evidence text not null default 'unknown' check (limit_evidence in ('unknown','customer_declared','contract_reviewed','operator_confirmed','expired')),
  limit_valid_from timestamptz,
  limit_valid_to timestamptz,
  automatic_dispatch_authorized boolean not null default false check (automatic_dispatch_authorized = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operations_sources (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_type text not null check (source_type in ('facility_meter','pdu','ups','nvidia_dcgm','bms','bess_ems','slurm','kubernetes','file_upload','weather','market')),
  display_name text not null,
  connector_version text not null,
  expected_interval_seconds integer check (expected_interval_seconds > 0),
  health text not null default 'not_connected' check (health in ('not_connected','healthy','delayed','stale','failed')),
  read_only boolean not null default true,
  last_received_at timestamptz,
  configuration_fingerprint text check (configuration_fingerprint is null or configuration_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (facility_id, display_name)
);

create table if not exists public.operations_measurements (
  id bigint generated always as identity primary key,
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  source_id uuid not null references public.operations_sources(id) on delete cascade,
  metric_key text not null check (metric_key in ('facility_grid_import_mw','it_load_mw','gpu_power_mw','gpu_utilization_percent','cooling_power_mw','auxiliary_power_mw','ups_output_mw','bess_power_mw','bess_soc_percent','scheduled_gpu_count','active_gpu_count','shiftable_load_mw')),
  asset_id text not null default 'facility',
  event_at timestamptz not null,
  received_at timestamptz not null default now(),
  interval_seconds integer check (interval_seconds is null or interval_seconds > 0),
  value numeric not null,
  unit text not null,
  value_kind text not null default 'observed' check (value_kind in ('observed','customer_entered','calculated')),
  quality text not null default 'accepted' check (quality in ('accepted','missing','late','stale','suspect','rejected')),
  source_record_id text not null,
  ingestion_batch_id uuid not null,
  created_at timestamptz not null default now(),
  unique (source_id, source_record_id, metric_key, asset_id)
);

create index if not exists operations_measurements_lookup_idx on public.operations_measurements(facility_id, metric_key, event_at desc);

create table if not exists public.operations_forecasts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  generated_at timestamptz not null,
  evidence_cutoff timestamptz not null,
  horizon_minutes integer not null check (horizon_minutes > 0),
  model_name text not null,
  model_version text not null,
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  promotion_status text not null check (promotion_status in ('candidate','accepted','rejected','retired')),
  metrics jsonb not null default '{}'::jsonb,
  intervals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.operations_recommendations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  forecast_id uuid references public.operations_forecasts(id) on delete set null,
  generated_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > generated_at),
  state text not null default 'shadow' check (state in ('shadow','expired','verified','rejected')),
  required_reduction_mw numeric not null check (required_reduction_mw >= 0),
  bess_discharge_mw numeric not null default 0 check (bess_discharge_mw >= 0),
  workload_shift_mw numeric not null default 0 check (workload_shift_mw >= 0),
  expected_import_mw numeric not null check (expected_import_mw >= 0),
  expected_workload_delay_minutes numeric not null default 0 check (expected_workload_delay_minutes >= 0),
  feasible boolean not null,
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  calculation_version text not null,
  automatic_dispatch_authorized boolean not null default false check (automatic_dispatch_authorized = false),
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.operations_verifications (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.operations_recommendations(id) on delete cascade,
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  requested_reduction_mw numeric not null check (requested_reduction_mw >= 0),
  delivered_reduction_mw numeric not null check (delivered_reduction_mw >= 0),
  response_seconds integer check (response_seconds is null or response_seconds >= 0),
  sustained_minutes numeric check (sustained_minutes is null or sustained_minutes >= 0),
  rebound_peak_mw numeric check (rebound_peak_mw is null or rebound_peak_mw >= 0),
  workload_delay_minutes numeric check (workload_delay_minutes is null or workload_delay_minutes >= 0),
  evidence_cutoff timestamptz not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.operations_facilities enable row level security;
alter table public.operations_sources enable row level security;
alter table public.operations_measurements enable row level security;
alter table public.operations_forecasts enable row level security;
alter table public.operations_recommendations enable row level security;
alter table public.operations_verifications enable row level security;

create policy "owners manage operations facilities" on public.operations_facilities for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners manage operations sources" on public.operations_sources for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners read operations measurements" on public.operations_measurements for select to authenticated using (exists(select 1 from public.operations_facilities f where f.id=facility_id and f.owner_id=auth.uid()));
create policy "owners manage operations forecasts" on public.operations_forecasts for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners manage operations recommendations" on public.operations_recommendations for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners manage operations verifications" on public.operations_verifications for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());

revoke insert, update, delete on public.operations_measurements from anon, authenticated;
grant select on public.operations_facilities, public.operations_sources, public.operations_measurements, public.operations_forecasts, public.operations_recommendations, public.operations_verifications to authenticated;
grant insert, update, delete on public.operations_facilities, public.operations_sources to authenticated;

comment on table public.operations_measurements is 'Normalized real operational measurements. Simulated values are prohibited.';
comment on table public.operations_recommendations is 'Read-only shadow recommendations; automatic physical dispatch is structurally prohibited.';
