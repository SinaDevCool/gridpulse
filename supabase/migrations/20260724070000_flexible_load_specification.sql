-- Phase 3: extend the existing versioned flexibility profile with a canonical
-- operational specification. Interval data remains in interval_profiles.

alter table public.flexibility_profiles
  add column if not exists profile_id uuid references public.interval_profiles(id) on delete set null,
  add column if not exists ramp_down_mw_per_min numeric(10,3) not null default 0 check (ramp_down_mw_per_min >= 0),
  add column if not exists ramp_up_mw_per_min numeric(10,3) not null default 0 check (ramp_up_mw_per_min >= 0),
  add column if not exists ups_power_mw numeric(10,3) not null default 0 check (ups_power_mw >= 0),
  add column if not exists ups_energy_mwh numeric(10,3) not null default 0 check (ups_energy_mwh >= 0),
  add column if not exists generator_power_mw numeric(10,3) not null default 0 check (generator_power_mw >= 0),
  add column if not exists generator_max_hours_year numeric(10,3) not null default 0 check (generator_max_hours_year >= 0),
  add column if not exists battery_round_trip_efficiency numeric(6,5) not null default 0.9
    check (battery_round_trip_efficiency > 0 and battery_round_trip_efficiency <= 1),
  add column if not exists battery_minimum_soc numeric(6,5) not null default 0.1
    check (battery_minimum_soc >= 0 and battery_minimum_soc <= 1),
  add column if not exists initial_battery_soc numeric(6,5) not null default 1
    check (initial_battery_soc >= 0 and initial_battery_soc <= 1),
  add column if not exists validation_report jsonb not null default '{}'::jsonb,
  add column if not exists specification_version text not null default 'flexible-load-v1';

create index if not exists flexibility_profiles_profile_id_idx
  on public.flexibility_profiles(profile_id);

comment on column public.flexibility_profiles.validation_report is
  'Deterministic customer-side consistency checks; not evidence of network capacity.';
