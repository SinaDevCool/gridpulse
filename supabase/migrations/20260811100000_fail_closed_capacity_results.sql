-- Capacity-result hardening: browser clients may read authorised projections only.
-- Physics publishers use the service role; operator confirmation remains evidence-governed.
alter table public.node_capacity_results
  add column if not exists n0_capacity_mw numeric
  check (n0_capacity_mw is null or n0_capacity_mw >= 0);

revoke insert, update on public.network_capacity_study_runs, public.node_capacity_results
  from authenticated;
revoke insert on public.capacity_result_constraints from authenticated;

drop policy if exists "technical roles create capacity study runs" on public.network_capacity_study_runs;
drop policy if exists "technical roles update capacity study runs" on public.network_capacity_study_runs;
drop policy if exists "technical roles create node capacity results" on public.node_capacity_results;
drop policy if exists "reviewers update node capacity results" on public.node_capacity_results;
drop policy if exists "technical roles create capacity constraints" on public.capacity_result_constraints;

create or replace function public.private_capacity_map_results(
  p_workspace_id uuid, p_metric text default 'firm_import_mw'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
  if p_metric not in ('n0_import_mw','firm_import_mw','flexible_import_mw','bess_assisted_import_mw','staged_initial_import_mw','eventual_import_mw') then
    raise exception 'Unsupported capacity metric';
  end if;
  if not exists (
    select 1 from public.operator_pilot_workspaces w
    join public.candidate_sites cs on cs.id=w.site_id
    where w.id=p_workspace_id and public.can_read_assessment(cs.id)
  ) then
    return jsonb_build_object('nodes','[]'::jsonb,'access','workspace_required');
  end if;
  with latest as (
    select distinct on (r.public_node_id) r.*, s.model_version, s.scenario_label,
      s.security_case, s.completed_at,
      (r.validation_state in ('calculated','operator_reviewed','operator_confirmed')
        and (r.valid_until is null or r.valid_until > now())) as is_current
    from public.node_capacity_results r
    join public.network_capacity_study_runs s
      on s.id=r.study_run_id and s.workspace_id=r.workspace_id and s.site_id=r.site_id
    join public.grid_candidate_model_bus_links l
      on l.id=s.reconciliation_id and l.workspace_id=r.workspace_id and l.site_id=r.site_id
      and l.public_candidate_id=r.public_candidate_id and l.public_node_id=r.public_node_id
      and l.operator_bus_id=r.model_bus_id and l.match_status='accepted'
    where r.workspace_id=p_workspace_id and public.can_read_assessment(r.site_id)
      and s.status='completed'
    order by r.public_node_id, s.completed_at desc, r.created_at desc, r.id desc
  ), rows as (
    select jsonb_agg(jsonb_build_object(
      'resultId',id,'studyRunId',study_run_id,'publicNodeId',public_node_id,
      'candidateId',public_candidate_id,'modelBusId',model_bus_id,
      'valueMw',case when is_current then case p_metric
        when 'n0_import_mw' then n0_capacity_mw when 'firm_import_mw' then firm_capacity_mw
        when 'flexible_import_mw' then flexible_capacity_mw
        when 'bess_assisted_import_mw' then bess_assisted_capacity_mw
        when 'staged_initial_import_mw' then staged_initial_capacity_mw
        else eventual_capacity_mw end else null end,
      'n0CapacityMw',case when is_current then n0_capacity_mw else null end,
      'firmCapacityMw',case when is_current then firm_capacity_mw else null end,
      'flexibleCapacityMw',case when is_current then flexible_capacity_mw else null end,
      'bessAssistedCapacityMw',case when is_current then bess_assisted_capacity_mw else null end,
      'stagedInitialCapacityMw',case when is_current then staged_initial_capacity_mw else null end,
      'eventualCapacityMw',case when is_current then eventual_capacity_mw else null end,
      'restrictedHours',case when is_current then restricted_hours else null end,
      'restrictedEnergyMwh',case when is_current then restricted_energy_mwh else null end,
      'bindingCategory',binding_category,
      'validationState',case when validation_state='failed' then 'failed'
        when not is_current then 'stale' else validation_state end,
      'calculatedAt',completed_at,'modelVersion',model_version,
      'scenarioLabel',scenario_label,'securityCase',security_case
    ) order by public_node_id) nodes,
    count(*) filter(where is_current) calculated,
    count(*) filter(where is_current and validation_state in ('operator_reviewed','operator_confirmed')) reviewed,
    count(*) filter(where not is_current and validation_state<>'failed') stale,
    count(*) mapped
    from latest
  ) select jsonb_build_object(
    'nodes',coalesce(nodes,'[]'::jsonb),'access','ready',
    'coverage',jsonb_build_object('mapped',coalesce(mapped,0),'calculated',coalesce(calculated,0),
      'reviewed',coalesce(reviewed,0),'stale',coalesce(stale,0),
      'unknown',greatest(0,coalesce(mapped,0)-coalesce(calculated,0)-coalesce(stale,0))),
    'evidenceBoundary','Authorised node result from an accepted candidate-to-model-bus link and completed private electrical study; not a connection offer or reservation.'
  ) into payload from rows;
  return payload;
end $$;

create or replace function public.review_node_capacity_result(
  p_result_id uuid, p_state text, p_review_note text default null,
  p_valid_until timestamptz default null
) returns public.node_capacity_results
language plpgsql security definer set search_path='' as $$
declare result public.node_capacity_results%rowtype;
begin
  if p_state <> 'operator_reviewed' then
    raise exception 'Operator confirmation requires the governed evidence approval workflow';
  end if;
  select * into result from public.node_capacity_results where id=p_result_id for update;
  if not found or public.get_assessment_role(result.site_id) <> 'operator_reviewer' then
    raise exception 'Operator reviewer access required';
  end if;
  if p_valid_until is not null and p_valid_until <= now() then
    raise exception 'Validity end must be in the future';
  end if;
  update public.node_capacity_results set validation_state='operator_reviewed',
    reviewed_by=auth.uid(), reviewed_at=now(), review_note=p_review_note,
    valid_until=p_valid_until where id=p_result_id returning * into result;
  return result;
end $$;

revoke all on function public.private_capacity_map_results(uuid,text),
  public.review_node_capacity_result(uuid,text,text,timestamptz) from public, anon;
grant execute on function public.private_capacity_map_results(uuid,text),
  public.review_node_capacity_result(uuid,text,text,timestamptz) to authenticated;
