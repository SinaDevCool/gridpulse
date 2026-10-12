create table if not exists public.grid_graph_physics_compilations (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  projection_sha256 text not null check (projection_sha256 ~ '^[a-f0-9]{64}$'),
  compiled_model_sha256 text not null check (compiled_model_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null, electrical_completeness_passed boolean not null default false,
  created_at timestamptz not null default now(), unique(model_key, compiled_model_sha256)
);
create table if not exists public.grid_graph_contingency_plans (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  plan_sha256 text not null check (plan_sha256 ~ '^[a-f0-9]{64}$'),
  scenario_count integer not null check (scenario_count > 0), mandatory_scenario_ids jsonb not null,
  plan_payload jsonb not null, operator_switching_approval_required boolean not null default true,
  created_at timestamptz not null default now(), unique(model_key, plan_sha256)
);
create table if not exists public.grid_graph_physics_attachments (
  id uuid primary key default gen_random_uuid(), model_key text not null,
  projection_sha256 text not null check (projection_sha256 ~ '^[a-f0-9]{64}$'),
  attachment_sha256 text not null check (attachment_sha256 ~ '^[a-f0-9]{64}$'),
  attachment_payload jsonb not null, physics_verified boolean not null check (physics_verified = true),
  stale boolean not null default false, created_at timestamptz not null default now(),
  unique(model_key, attachment_sha256)
);
create table if not exists public.grid_graph_operator_promotions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid references public.operator_pilot_workspaces(id) on delete restrict,
  model_key text not null, requested_class text not null check(requested_class in ('operator_model_reconciled','operator_reviewed','operator_confirmed')),
  promotion_sha256 text not null check (promotion_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_payload jsonb not null, decision text not null check(decision in ('approved','rejected')),
  operator_confirmation_created boolean not null default false,
  created_at timestamptz not null default now(), unique(model_key, promotion_sha256)
);
alter table public.grid_graph_physics_compilations enable row level security;
alter table public.grid_graph_contingency_plans enable row level security;
alter table public.grid_graph_physics_attachments enable row level security;
alter table public.grid_graph_operator_promotions enable row level security;
revoke all on public.grid_graph_physics_compilations, public.grid_graph_contingency_plans,
  public.grid_graph_physics_attachments, public.grid_graph_operator_promotions from public, anon, authenticated;
grant select, insert, update, delete on public.grid_graph_physics_compilations,
  public.grid_graph_contingency_plans, public.grid_graph_physics_attachments,
  public.grid_graph_operator_promotions to service_role;
