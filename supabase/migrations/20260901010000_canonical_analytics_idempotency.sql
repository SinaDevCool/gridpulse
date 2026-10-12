-- Owner-scoped deterministic identity for canonical analytical jobs.
alter table public.analytics_jobs
  add column if not exists input_fingerprint text;

alter table public.analytics_jobs
  drop constraint if exists analytics_jobs_input_fingerprint_format;
alter table public.analytics_jobs
  add constraint analytics_jobs_input_fingerprint_format check (
    input_fingerprint is null or input_fingerprint ~ '^[a-f0-9]{64}$'
  );

alter table public.analytics_jobs drop constraint if exists analytics_jobs_job_type_check;
alter table public.analytics_jobs add constraint analytics_jobs_job_type_check check (job_type in (
  'operator_source_health','profile_validation','corridor_ranking','activation_scenario',
  'network_simulation','reference_topology','flexibility_optimization','synthetic_capacity',
  'release_b_network','c1_network_study','c2_hourly_capacity','c3_security_flexibility',
  'c4_reconciliation','p0_p4_permutation','release3_shadow_validation','graph_guided_study',
  'capacity_requirement','facility_plan','facility_uncertainty','facility_historical_replay',
  'operator_enquiry_package','shadow_verification','fca_interval',
  'market_qualification','rolling_facility_plan'
));

create unique index if not exists analytics_jobs_canonical_input_idx
  on public.analytics_jobs (owner_id, job_type, input_fingerprint)
  where input_fingerprint is not null;

comment on column public.analytics_jobs.input_fingerprint is
  'SHA-256 of the canonical request payload; deduplicates an owner''s identical analytical jobs.';
