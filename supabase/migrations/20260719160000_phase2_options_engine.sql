-- Phase 2: reproducible profile inputs and connection-option outputs.

alter table public.interval_profiles
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists source_hash text,
  add column if not exists column_mapping jsonb not null default '{}'::jsonb,
  add column if not exists source_classification text not null default 'customer_input'
    check (source_classification in ('customer_input','operator_source','official_source','derived')),
  add column if not exists supersedes_id uuid references public.interval_profiles(id) on delete set null;

create unique index if not exists interval_profiles_site_name_version_idx
  on public.interval_profiles(site_id, name, version);

alter table public.flexibility_profiles
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists maximum_curtailment_mw numeric(10,3) check (maximum_curtailment_mw >= 0),
  add column if not exists maximum_event_duration_hours numeric(10,3) check (maximum_event_duration_hours >= 0),
  add column if not exists maximum_events_per_day integer check (maximum_events_per_day >= 0),
  add column if not exists recovery_hours numeric(10,3) check (recovery_hours >= 0),
  add column if not exists geographic_transfer_mw numeric(10,3) not null default 0 check (geographic_transfer_mw >= 0),
  add column if not exists sla_constraints text,
  add column if not exists supersedes_id uuid references public.flexibility_profiles(id) on delete set null;

create unique index if not exists flexibility_profiles_site_name_version_idx
  on public.flexibility_profiles(site_id, name, version);

alter table public.flexibility_simulations
  add column if not exists input_manifest jsonb not null default '{}'::jsonb,
  add column if not exists classification text not null default 'insufficient_evidence'
    check (classification in (
      'operationally_feasible','feasible_with_constraints','fails_minimum_viable_capacity',
      'insufficient_evidence','operator_validation_required','superseded'
    ));

alter table public.operator_packages
  add column if not exists methodology_version text not null default 'de-connection-options-v1',
  add column if not exists input_manifest jsonb not null default '{}'::jsonb;

comment on column public.flexibility_simulations.classification is
  'Customer-side operational classification only; never confirmation of network capacity.';
