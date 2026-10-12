-- Forward-only refactor. Invoker rights preserve existing RLS and editor policies.
create or replace function public.gridpulse_prefer_strategy(p_site_id uuid, p_scenario_id uuid, p_rationale text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.can_edit_assessment(p_site_id) then
    raise exception 'Assessment editing permission required';
  end if;
  if nullif(trim(p_rationale), '') is null then raise exception 'Rationale required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text, 0));
  if not exists(select 1 from public.connection_scenarios where id = p_scenario_id and site_id = p_site_id) then
    raise exception 'Scenario does not belong to assessment';
  end if;
  update public.connection_scenarios set selection_status = 'candidate'
    where site_id = p_site_id and selection_status = 'preferred';
  update public.connection_scenarios set selection_status = 'preferred', selection_rationale = trim(p_rationale)
    where site_id = p_site_id and id = p_scenario_id;
end $$;

create or replace function public.gridpulse_record_strategy_decision(p_site_id uuid, p_decision jsonb, p_actions jsonb, p_activity jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare decision public.connection_decisions; next_version integer; action jsonb;
begin
  if auth.uid() is null or not public.can_edit_assessment(p_site_id) then
    raise exception 'Assessment editing permission required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text, 0));
  select coalesce(max(version), 0) + 1 into next_version from public.connection_decisions where site_id = p_site_id;
  if not exists(select 1 from public.connection_scenarios where id = (p_decision->>'scenario_id')::uuid and site_id = p_site_id) then
    raise exception 'Scenario does not belong to assessment';
  end if;
  if p_decision->>'package_id' is not null and not exists(select 1 from public.operator_packages where id = (p_decision->>'package_id')::uuid and site_id = p_site_id) then
    raise exception 'Package does not belong to assessment';
  end if;
  insert into public.connection_decisions(site_id, scenario_id, package_id, user_id, version, status, rationale,
    alternatives_rejected, conditions_to_proceed, assumptions, evidence_ids)
  values(p_site_id, (p_decision->>'scenario_id')::uuid, (p_decision->>'package_id')::uuid, auth.uid(), next_version,
    'draft', p_decision->>'rationale', coalesce(p_decision->'alternatives_rejected', '[]'),
    coalesce(p_decision->'conditions_to_proceed', '[]'), coalesce(p_decision->'assumptions', '[]'),
    array(select jsonb_array_elements_text(coalesce(p_decision->'evidence_ids', '[]'))::uuid)) returning * into decision;
  for action in select value from jsonb_array_elements(p_actions) loop
    insert into public.assessment_milestones(site_id, user_id, title, milestone_type, status, due_at, notes)
    values(p_site_id, auth.uid(), action->>'title', 'strategy_execution', 'open', (action->>'due_at')::timestamptz,
      format('Generated from decision v%s (%s).', next_version, decision.id));
  end loop;
  insert into public.assessment_activity(site_id, actor_id, event_type, entity_type, entity_id, summary, details)
  values(p_site_id, auth.uid(), 'decision_created', 'connection_decision', decision.id,
    format('Decision v%s created for %s', next_version, p_activity->>'scenario_name'),
    jsonb_build_object('scenarioId', decision.scenario_id, 'packageId', decision.package_id));
  return jsonb_build_object('id', decision.id, 'version', decision.version);
end $$;

revoke all on function public.gridpulse_prefer_strategy(uuid, uuid, text) from public;
create or replace function public.gridpulse_append_flexibility(p_site_id uuid, p_profile jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare previous public.flexibility_profiles; saved public.flexibility_profiles;
begin
  if auth.uid() is null or not public.can_edit_assessment(p_site_id) then
    raise exception 'Assessment editing permission required';
  end if;
  if nullif(trim(p_profile->>'name'), '') is null then raise exception 'Profile name required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text, 0));
  select * into previous from public.flexibility_profiles where site_id = p_site_id and name = p_profile->>'name'
    order by version desc limit 1;
  if p_profile->>'profile_id' is not null and not exists(select 1 from public.interval_profiles where id = (p_profile->>'profile_id')::uuid and site_id = p_site_id) then
    raise exception 'Interval profile does not belong to assessment';
  end if;
  saved := jsonb_populate_record(null::public.flexibility_profiles, p_profile || jsonb_build_object(
    'id', gen_random_uuid(), 'site_id', p_site_id, 'user_id', auth.uid(), 'version', coalesce(previous.version,0)+1,
    'supersedes_id', previous.id, 'status', 'calculated', 'created_at', now(), 'updated_at', now(),
    'calculation_version', 'de-fca-envelope-v2'));
  insert into public.flexibility_profiles select saved.*;
  return jsonb_build_object('id', saved.id, 'version', saved.version);
end $$;
revoke all on function public.gridpulse_append_flexibility(uuid,jsonb) from public;
grant execute on function public.gridpulse_append_flexibility(uuid,jsonb) to authenticated;
revoke all on function public.gridpulse_record_strategy_decision(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.gridpulse_prefer_strategy(uuid, uuid, text) to authenticated;
grant execute on function public.gridpulse_record_strategy_decision(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.gridpulse_append_strategy_package(p_site_id uuid, p_package jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare saved public.operator_packages; next_version integer;
begin
  if auth.uid() is null or not public.can_edit_assessment(p_site_id) then raise exception 'Assessment editing permission required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text, 0));
  select coalesce(max(version),0)+1 into next_version from public.operator_packages where site_id = p_site_id;
  saved := jsonb_populate_record(null::public.operator_packages, p_package || jsonb_build_object(
    'id', gen_random_uuid(), 'site_id', p_site_id, 'user_id', auth.uid(), 'version', next_version,
    'created_at', now(), 'methodology_version', 'de-connection-options-v1'));
  insert into public.operator_packages select saved.*;
  return jsonb_build_object('id', saved.id, 'version', saved.version);
end $$;

create or replace function public.gridpulse_append_strategy_simulation(p_site_id uuid, p_simulation jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare saved public.flexibility_simulations; next_version integer; v_profile_id uuid := (p_simulation->>'profile_id')::uuid;
begin
  if auth.uid() is null or not public.can_edit_assessment(p_site_id) then raise exception 'Assessment editing permission required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text, 0));
  if not exists(select 1 from public.interval_profiles where id = v_profile_id and site_id = p_site_id) then
    raise exception 'Interval profile does not belong to assessment';
  end if;
  if p_simulation->>'scenario_id' is not null and not exists(select 1 from public.connection_scenarios where id = (p_simulation->>'scenario_id')::uuid and site_id = p_site_id) then
    raise exception 'Scenario does not belong to assessment';
  end if;
  select coalesce(max(version),0)+1 into next_version from public.flexibility_simulations
    where site_id = p_site_id and flexibility_simulations.profile_id = v_profile_id;
  saved := jsonb_populate_record(null::public.flexibility_simulations, p_simulation || jsonb_build_object(
    'id', gen_random_uuid(), 'site_id', p_site_id, 'user_id', auth.uid(), 'version', next_version, 'created_at', now()));
  insert into public.flexibility_simulations select saved.*;
  return jsonb_build_object('id', saved.id, 'version', saved.version);
end $$;
revoke all on function public.gridpulse_append_strategy_package(uuid,jsonb) from public;
revoke all on function public.gridpulse_append_strategy_simulation(uuid,jsonb) from public;
grant execute on function public.gridpulse_append_strategy_package(uuid,jsonb) to authenticated;
grant execute on function public.gridpulse_append_strategy_simulation(uuid,jsonb) to authenticated;
