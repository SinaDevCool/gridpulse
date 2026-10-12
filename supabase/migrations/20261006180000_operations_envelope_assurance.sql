-- Operations envelope and assurance extension.
-- Existing facility, measurement, forecast, recommendation and verification tables remain canonical.

alter table public.operations_measurements
  drop constraint if exists operations_measurements_metric_key_check;
alter table public.operations_measurements
  add constraint operations_measurements_metric_key_check check (metric_key in (
    'facility_grid_import_mw','it_load_mw','gpu_power_mw','gpu_utilization_percent',
    'cooling_power_mw','auxiliary_power_mw','ups_output_mw','bess_power_mw',
    'bess_soc_percent','scheduled_gpu_count','active_gpu_count','shiftable_load_mw',
    'onsite_generation_mw','renewable_energy_mwh','waste_heat_mwh','waste_heat_temperature_c'
  ));

create table if not exists public.operations_operating_agreements (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  connection_point_id text,
  operator_name text,
  agreement_type text not null check (agreement_type in ('static_contract','flexible_agreement','scenario_assumption')),
  evidence_class text not null check (evidence_class in ('operator_confirmed','contract_reviewed','customer_declared','simulated')),
  valid_from timestamptz not null,
  valid_to timestamptz,
  default_limit_mw numeric not null check (default_limit_mw > 0),
  interval_limits jsonb not null default '[]'::jsonb,
  ramp_limit_mw_per_minute numeric check (ramp_limit_mw_per_minute is null or ramp_limit_mw_per_minute > 0),
  notice_minutes integer check (notice_minutes is null or notice_minutes >= 0),
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create table if not exists public.operations_calculation_runs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  mode text not null check (mode in ('scenario','historical','shadow','live')),
  calculation_version text not null,
  evidence_cutoff timestamptz,
  forecast_id uuid references public.operations_forecasts(id) on delete set null,
  agreement_id uuid references public.operations_operating_agreements(id) on delete set null,
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  blockers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.operations_dispatch_approvals (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.operations_recommendations(id) on delete cascade,
  facility_id uuid not null references public.operations_facilities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  approver_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  decision text not null check (decision in ('approved','rejected','revoked')),
  decision_at timestamptz not null default now(),
  reason text,
  unique (recommendation_id, approver_id)
);

create index if not exists operations_operating_agreements_lookup_idx
  on public.operations_operating_agreements(facility_id, valid_from desc);
create index if not exists operations_calculation_runs_lookup_idx
  on public.operations_calculation_runs(facility_id, created_at desc);
create index if not exists operations_dispatch_approvals_lookup_idx
  on public.operations_dispatch_approvals(facility_id, decision_at desc);

alter table public.operations_operating_agreements enable row level security;
alter table public.operations_calculation_runs enable row level security;
alter table public.operations_dispatch_approvals enable row level security;

create policy "owners manage operating agreements" on public.operations_operating_agreements
  for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners read calculation runs" on public.operations_calculation_runs
  for select to authenticated using (owner_id=auth.uid());
create policy "owners manage dispatch approvals" on public.operations_dispatch_approvals
  for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());

grant select, insert, update, delete on public.operations_operating_agreements to authenticated;
grant select on public.operations_calculation_runs to authenticated;
grant select, insert, update, delete on public.operations_dispatch_approvals to authenticated;

comment on table public.operations_calculation_runs is
  'Immutable versioned Operations calculation results. This table does not issue physical commands.';
comment on table public.operations_dispatch_approvals is
  'Human approval evidence only. Approval does not itself authorize or execute physical dispatch.';
