-- Governed node-specific capacity results. Neo4j contributes topology and lineage;
-- only a completed electrical study may populate MW fields.
create table if not exists public.network_capacity_study_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  reconciliation_id uuid not null references public.grid_candidate_model_bus_links(id),
  model_id text not null,
  model_version text not null,
  scenario_id text not null,
  scenario_label text not null,
  security_case text not null check (security_case in ('n_0','n_1')),
  direction text not null default 'import' check (direction in ('import','export')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  engine_name text not null,
  engine_version text not null,
  input_sha256 text not null check (input_sha256 ~ '^[a-f0-9]{64}$'),
  dependency_sha256 text not null check (dependency_sha256 ~ '^[a-f0-9]{64}$'),
  failure_reason text,
  created_by uuid not null default auth.uid() references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or completed_at is not null)
);

create table if not exists public.node_capacity_results (
  id uuid primary key default gen_random_uuid(),
  study_run_id uuid not null references public.network_capacity_study_runs(id) on delete cascade,
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  public_candidate_id text not null,
  public_node_id text not null,
  model_bus_id text not null,
  firm_capacity_mw numeric check (firm_capacity_mw is null or firm_capacity_mw >= 0),
  flexible_capacity_mw numeric check (flexible_capacity_mw is null or flexible_capacity_mw >= 0),
  bess_assisted_capacity_mw numeric check (bess_assisted_capacity_mw is null or bess_assisted_capacity_mw >= 0),
  staged_initial_capacity_mw numeric check (staged_initial_capacity_mw is null or staged_initial_capacity_mw >= 0),
  eventual_capacity_mw numeric check (eventual_capacity_mw is null or eventual_capacity_mw >= 0),
  restricted_hours numeric check (restricted_hours is null or restricted_hours between 0 and 8760),
  restricted_energy_mwh numeric check (restricted_energy_mwh is null or restricted_energy_mwh >= 0),
  longest_event_hours numeric check (longest_event_hours is null or longest_event_hours between 0 and 8760),
  binding_category text,
  binding_asset_id text,
  validation_state text not null default 'calculated' check (validation_state in ('calculated','operator_reviewed','operator_confirmed','stale','failed')),
  result_sha256 text not null check (result_sha256 ~ '^[a-f0-9]{64}$'),
  dependency_sha256 text not null check (dependency_sha256 ~ '^[a-f0-9]{64}$'),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique(study_run_id, public_candidate_id),
  check (validation_state not in ('operator_reviewed','operator_confirmed') or reviewed_at is not null)
);

create table if not exists public.capacity_result_constraints (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.node_capacity_results(id) on delete cascade,
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  asset_id text not null,
  category text not null check (category in ('thermal','voltage_security','transformer','short_circuit','other')),
  contingency_id text,
  observed_value numeric,
  limit_value numeric,
  unit text,
  severity numeric check (severity is null or severity between 0 and 1),
  created_at timestamptz not null default now()
);

create index if not exists node_capacity_results_workspace_node_idx
  on public.node_capacity_results(workspace_id, public_node_id, created_at desc);
create index if not exists capacity_result_constraints_result_idx
  on public.capacity_result_constraints(result_id);

alter table public.network_capacity_study_runs enable row level security;
alter table public.node_capacity_results enable row level security;
alter table public.capacity_result_constraints enable row level security;
revoke all on public.network_capacity_study_runs, public.node_capacity_results, public.capacity_result_constraints from public, anon;
grant select, insert, update on public.network_capacity_study_runs, public.node_capacity_results to authenticated;
grant select, insert on public.capacity_result_constraints to authenticated;

create policy "participants read capacity study runs" on public.network_capacity_study_runs
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "technical roles create capacity study runs" on public.network_capacity_study_runs
  for insert to authenticated with check (
    public.get_assessment_role(site_id) in ('technical_reviewer','grid_expert','operator_reviewer','workspace_admin')
    and created_by=auth.uid()
  );
create policy "technical roles update capacity study runs" on public.network_capacity_study_runs
  for update to authenticated using (public.get_assessment_role(site_id) in ('grid_expert','operator_reviewer','workspace_admin'));
create policy "participants read node capacity results" on public.node_capacity_results
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "technical roles create node capacity results" on public.node_capacity_results
  for insert to authenticated with check (public.get_assessment_role(site_id) in ('grid_expert','operator_reviewer','workspace_admin'));
create policy "reviewers update node capacity results" on public.node_capacity_results
  for update to authenticated using (public.get_assessment_role(site_id) in ('operator_reviewer','workspace_admin'));
create policy "participants read capacity constraints" on public.capacity_result_constraints
  for select to authenticated using (
    exists(select 1 from public.node_capacity_results r where r.id=result_id and public.can_read_assessment(r.site_id))
  );
create policy "technical roles create capacity constraints" on public.capacity_result_constraints
  for insert to authenticated with check (
    exists(select 1 from public.node_capacity_results r where r.id=result_id and public.get_assessment_role(r.site_id) in ('grid_expert','operator_reviewer','workspace_admin'))
  );

create or replace function public.private_capacity_map_results(p_workspace_id uuid, p_metric text default 'firm_import_mw')
returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb; mapped_count integer;
begin
  if p_metric not in ('firm_import_mw','flexible_import_mw','bess_assisted_import_mw','staged_initial_import_mw','eventual_import_mw') then
    raise exception 'Unsupported capacity metric';
  end if;
  if not exists (
    select 1 from public.node_capacity_results r
    where r.workspace_id=p_workspace_id and public.can_read_assessment(r.site_id)
  ) then
    return jsonb_build_object('nodes','[]'::jsonb,'access','workspace_required');
  end if;
  with latest as (
    select distinct on (r.public_node_id) r.*, s.model_version, s.scenario_label, s.security_case, s.completed_at
    from public.node_capacity_results r join public.network_capacity_study_runs s on s.id=r.study_run_id
    where r.workspace_id=p_workspace_id and public.can_read_assessment(r.site_id) and s.status='completed'
    order by r.public_node_id, r.created_at desc
  ), rows as (
    select jsonb_agg(jsonb_build_object(
      'resultId',id,'studyRunId',study_run_id,'publicNodeId',public_node_id,'candidateId',public_candidate_id,
      'modelBusId',model_bus_id,'valueMw',case p_metric
        when 'firm_import_mw' then firm_capacity_mw when 'flexible_import_mw' then flexible_capacity_mw
        when 'bess_assisted_import_mw' then bess_assisted_capacity_mw when 'staged_initial_import_mw' then staged_initial_capacity_mw
        else eventual_capacity_mw end,
      'firmCapacityMw',firm_capacity_mw,'flexibleCapacityMw',flexible_capacity_mw,
      'bessAssistedCapacityMw',bess_assisted_capacity_mw,'stagedInitialCapacityMw',staged_initial_capacity_mw,
      'eventualCapacityMw',eventual_capacity_mw,'restrictedHours',restricted_hours,
      'restrictedEnergyMwh',restricted_energy_mwh,'bindingCategory',binding_category,
      'validationState',validation_state,'calculatedAt',completed_at,'modelVersion',model_version,
      'scenarioLabel',scenario_label,'securityCase',security_case
    )) nodes,
    count(*) filter(where validation_state in ('calculated','operator_reviewed','operator_confirmed')) calculated,
    count(*) filter(where validation_state in ('operator_reviewed','operator_confirmed')) reviewed,
    count(*) filter(where validation_state='stale') stale from latest
  ) select jsonb_build_object(
    'nodes',coalesce(nodes,'[]'::jsonb),'access','ready',
    'coverage',jsonb_build_object('mapped',coalesce(calculated,0)+coalesce(stale,0),'calculated',coalesce(calculated,0),'reviewed',coalesce(reviewed,0),'stale',coalesce(stale,0),'unknown',0),
    'evidenceBoundary','Node-specific result from an accepted private model and completed electrical study; not a connection offer or reservation.'
  ) into payload from rows;
  return payload;
end $$;

revoke all on function public.private_capacity_map_results(uuid,text) from public, anon;
grant execute on function public.private_capacity_map_results(uuid,text) to authenticated;

create or replace function public.review_node_capacity_result(
  p_result_id uuid, p_state text, p_review_note text default null, p_valid_until timestamptz default null
) returns public.node_capacity_results
language plpgsql security definer set search_path='' as $$
declare result public.node_capacity_results%rowtype;
begin
  if p_state not in ('operator_reviewed','operator_confirmed') then
    raise exception 'Unsupported review state';
  end if;
  select * into result from public.node_capacity_results where id=p_result_id for update;
  if not found or public.get_assessment_role(result.site_id) not in ('operator_reviewer','workspace_admin') then
    raise exception 'Operator reviewer access required';
  end if;
  update public.node_capacity_results set validation_state=p_state, reviewed_by=auth.uid(),
    reviewed_at=now(), review_note=p_review_note, valid_until=p_valid_until
    where id=p_result_id returning * into result;
  return result;
end $$;

create or replace function public.invalidate_stale_capacity_results(
  p_workspace_id uuid, p_dependency_sha256 text
) returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  if p_dependency_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Invalid dependency hash'; end if;
  if not exists(select 1 from public.node_capacity_results r where r.workspace_id=p_workspace_id
    and public.get_assessment_role(r.site_id) in ('grid_expert','operator_reviewer','workspace_admin')) then
    raise exception 'Technical reviewer access required';
  end if;
  update public.node_capacity_results set validation_state='stale'
    where workspace_id=p_workspace_id and dependency_sha256<>p_dependency_sha256
      and validation_state in ('calculated','operator_reviewed','operator_confirmed');
  get diagnostics affected=row_count;
  return affected;
end $$;

revoke all on function public.review_node_capacity_result(uuid,text,text,timestamptz),
  public.invalidate_stale_capacity_results(uuid,text) from public, anon;
grant execute on function public.review_node_capacity_result(uuid,text,text,timestamptz),
  public.invalidate_stale_capacity_results(uuid,text) to authenticated;
