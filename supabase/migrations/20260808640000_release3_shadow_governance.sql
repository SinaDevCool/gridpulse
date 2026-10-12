-- Release 3: private operator-shadow validation and champion governance.

create table if not exists public.grid_shadow_validation_runs (
  id uuid primary key default gen_random_uuid(),
  analytics_job_id uuid not null references public.analytics_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.operator_pilot_workspaces(id) on delete restrict,
  model_dataset_hash text not null check (model_dataset_hash ~ '^[a-f0-9]{64}$'),
  validation_class text not null check (validation_class in (
    'synthetic_demonstration','operator_model_unvalidated','operator_model_reconciled','operator_reviewed'
  )),
  report_sha256 text not null check (report_sha256 ~ '^[a-f0-9]{64}$'),
  metrics jsonb not null,
  drift_report jsonb not null,
  feature_importance jsonb not null,
  technical_gates jsonb not null,
  technical_gates_passed boolean not null,
  decision text not null check (decision in ('retain_challenger','approve_internal_champion')),
  capacity_claim boolean not null default false check (capacity_claim = false),
  status text not null check (status in ('completed','review_required','approved','rejected','superseded')),
  created_at timestamptz not null default now(),
  unique(analytics_job_id, report_sha256)
);

create table if not exists public.grid_shadow_observations (
  id bigint generated always as identity primary key,
  shadow_run_id uuid not null references public.grid_shadow_validation_runs(id) on delete cascade,
  scenario_id text not null,
  scenario_sha256 text not null check (scenario_sha256 ~ '^[a-f0-9]{64}$'),
  surrogate_prediction_mw double precision not null,
  physics_verified_capacity_mw double precision not null,
  absolute_error_mw double precision not null check (absolute_error_mw >= 0),
  false_safe boolean not null,
  out_of_distribution boolean not null,
  uncertainty_span_mw double precision not null check (uncertainty_span_mw >= 0),
  predicted_binding_constraint text,
  verified_binding_constraint text,
  physics_verified boolean not null check (physics_verified = true),
  requires_physics_verification boolean not null check (requires_physics_verification = true),
  display_as_capacity boolean not null check (display_as_capacity = false),
  created_at timestamptz not null default now(),
  unique(shadow_run_id, scenario_sha256)
);

create table if not exists public.grid_champion_history (
  id bigint generated always as identity primary key,
  shadow_run_id uuid not null references public.grid_shadow_validation_runs(id) on delete restrict,
  model_dataset_hash text not null,
  prior_status text,
  next_status text not null check (next_status in ('challenger','internal_champion','retired')),
  operator_review_id uuid references public.operator_model_reviews(id) on delete restrict,
  actor_id uuid references auth.users(id),
  reason text not null,
  event_sha256 text not null check (event_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.grid_shadow_validation_runs enable row level security;
alter table public.grid_shadow_observations enable row level security;
alter table public.grid_champion_history enable row level security;
revoke all on public.grid_shadow_validation_runs, public.grid_shadow_observations,
  public.grid_champion_history from public, anon, authenticated;
grant select, insert, update, delete on public.grid_shadow_validation_runs,
  public.grid_shadow_observations, public.grid_champion_history to service_role;
grant usage, select on sequence public.grid_shadow_observations_id_seq,
  public.grid_champion_history_id_seq to service_role;

create or replace function public.approve_release3_internal_champion(
  p_shadow_run_id uuid,
  p_model_review_id uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  run public.grid_shadow_validation_runs%rowtype;
  review public.operator_model_reviews%rowtype;
  training_allowed boolean;
  event_digest text;
begin
  select * into run from public.grid_shadow_validation_runs where id = p_shadow_run_id for update;
  if not found or run.workspace_id is null then raise exception 'Operator workspace required'; end if;
  select * into review from public.operator_model_reviews where id = p_model_review_id;
  if not found or review.workspace_id <> run.workspace_id or review.review_status not in ('reviewed','confirmed') then
    raise exception 'Matching operator model review required';
  end if;
  if public.get_assessment_role((select site_id from public.operator_pilot_workspaces where id=run.workspace_id))
     not in ('operator_reviewer','workspace_admin') then raise exception 'Operator reviewer required'; end if;
  select exists(
    select 1 from public.operator_pilot_agreements
    where workspace_id=run.workspace_id and agreement_type='data_use' and status='signed'
      and coalesce(scope->>'model_training_allowed','false') = 'true'
  ) into training_allowed;
  if run.validation_class not in ('operator_model_reconciled','operator_reviewed')
     or not run.technical_gates_passed or not training_allowed then
    raise exception 'Validation, technical gates, and signed training permission required';
  end if;
  update public.grid_shadow_validation_runs
    set decision='approve_internal_champion', status='approved'
    where id=p_shadow_run_id;
  event_digest := encode(extensions.digest(
    p_shadow_run_id::text || p_model_review_id::text || run.model_dataset_hash || now()::text,
    'sha256'
  ),'hex');
  insert into public.grid_champion_history(
    shadow_run_id,model_dataset_hash,prior_status,next_status,operator_review_id,actor_id,reason,event_sha256
  ) values (
    p_shadow_run_id,run.model_dataset_hash,'challenger','internal_champion',p_model_review_id,
    auth.uid(),'operator_review_and_technical_gates_passed',event_digest
  );
  return 'internal_champion';
end $$;
revoke all on function public.approve_release3_internal_champion(uuid,uuid) from public,anon;
grant execute on function public.approve_release3_internal_champion(uuid,uuid) to authenticated;

create or replace function public.prevent_champion_history_mutation() returns trigger
language plpgsql as $$ begin raise exception 'Champion history is immutable'; end $$;
create trigger grid_champion_history_immutable before update or delete on public.grid_champion_history
for each row execute function public.prevent_champion_history_mutation();
