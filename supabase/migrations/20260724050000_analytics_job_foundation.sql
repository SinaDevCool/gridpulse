-- Durable, tenant-owned execution records for the Python analytics service.
create table if not exists public.analytics_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (
    job_type in (
      'operator_source_health',
      'profile_validation',
      'corridor_ranking',
      'activation_scenario',
      'network_simulation',
      'flexibility_optimization'
    )
  ),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint analytics_jobs_error_length check (error is null or length(error) <= 2000),
  constraint analytics_jobs_terminal_time check (
    status not in ('succeeded', 'failed', 'cancelled') or completed_at is not null
  )
);

create index if not exists analytics_jobs_owner_created_idx
  on public.analytics_jobs (owner_id, created_at desc);

create index if not exists analytics_jobs_runnable_idx
  on public.analytics_jobs (status, created_at)
  where status in ('queued', 'running');

alter table public.analytics_jobs enable row level security;

drop policy if exists analytics_jobs_select_own on public.analytics_jobs;
create policy analytics_jobs_select_own
  on public.analytics_jobs
  for select
  to authenticated
  using (owner_id = auth.uid());

revoke insert, update, delete on public.analytics_jobs from anon, authenticated;
grant select on public.analytics_jobs to authenticated;

comment on table public.analytics_jobs is
  'Durable execution metadata. Service-role workers mutate jobs; authenticated owners may read only their own records.';

