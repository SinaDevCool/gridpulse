-- Idempotency, solver quarantine and topology-reduction audit controls.
alter table public.analytics_jobs
  add column if not exists workspace_id uuid,
  add column if not exists model_version_id uuid references public.grid_model_versions(id),
  add column if not exists scenario_family_sha256 text,
  add column if not exists solver_version text,
  add column if not exists idempotency_key text,
  add column if not exists topology_provider text,
  add column if not exists gds_projection_sha256 text,
  add column if not exists structured_log_context jsonb not null default '{}'::jsonb;

create unique index if not exists analytics_jobs_idempotency_idx
on public.analytics_jobs(idempotency_key) where idempotency_key is not null;

create table if not exists public.analytics_job_quarantine (
  id uuid primary key default gen_random_uuid(),
  analytics_job_id uuid not null references public.analytics_jobs(id) on delete cascade,
  scenario_sha256 text not null check (scenario_sha256 ~ '^[0-9a-f]{64}$'),
  safe_error_code text not null,
  retry_class text not null check (retry_class in ('transient','input_invalid','non_convergence','resource','unknown')),
  attempt integer not null check (attempt > 0),
  safe_details jsonb not null default '{}'::jsonb,
  quarantined_at timestamptz not null default now(),
  unique(analytics_job_id,scenario_sha256,attempt)
);

create table if not exists public.graph_reduction_policies (
  id uuid primary key default gen_random_uuid(),
  model_family text not null,
  model_version text not null,
  policy_version text not null,
  mandatory_recall numeric not null check (mandatory_recall between 0 and 1),
  worst_case_recall numeric not null check (worst_case_recall between 0 and 1),
  false_safe_rate numeric not null check (false_safe_rate between 0 and 1),
  compute_reduction numeric not null check (compute_reduction between 0 and 1),
  accepted_for_reduced_search boolean not null default false,
  benchmark_manifest jsonb not null,
  created_at timestamptz not null default now(),
  unique(model_family,model_version,policy_version),
  check (not accepted_for_reduced_search or (mandatory_recall = 1 and false_safe_rate = 0))
);

alter table public.analytics_job_quarantine enable row level security;
alter table public.graph_reduction_policies enable row level security;
revoke all on public.analytics_job_quarantine,public.graph_reduction_policies from anon,authenticated;
