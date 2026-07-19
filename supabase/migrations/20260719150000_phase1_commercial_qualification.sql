-- Phase 1: qualify real projects before converting them into private workspaces.
alter table public.pilot_requests
  add column if not exists minimum_viable_import_mw numeric(12,3)
    check (minimum_viable_import_mw is null or minimum_viable_import_mw >= 0),
  add column if not exists candidate_site_count smallint not null default 1
    check (candidate_site_count between 1 and 20),
  add column if not exists operator_engagement_status text not null default 'not_started'
    check (operator_engagement_status in ('not_started','identified','contacted','pre_application','application_submitted','study_in_progress','response_received')),
  add column if not exists land_status text not null default 'unknown'
    check (land_status in ('unknown','identified','optioned','controlled')),
  add column if not exists planning_status text not null default 'unknown'
    check (planning_status in ('unknown','not_started','pre_application','submitted','approved')),
  add column if not exists load_profile_available boolean not null default false,
  add column if not exists flexibility_status text not null default 'unknown'
    check (flexibility_status in ('unknown','none','static_limit','dynamic_limit','workload_shift','battery_supported','combined')),
  add column if not exists commercial_deadline date;

comment on column public.pilot_requests.minimum_viable_import_mw is
  'Customer-declared minimum viable import; not available network capacity.';
comment on column public.pilot_requests.flexibility_status is
  'Customer-declared operating flexibility for pilot qualification only.';
