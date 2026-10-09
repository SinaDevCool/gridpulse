-- Release 3 completion: securely bind a private shadow run to an authorised
-- operator workspace and require reconciled evidence at champion approval.

create or replace function public.attach_release3_shadow_run_to_workspace(
  p_shadow_run_id uuid,
  p_workspace_id uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  target_site uuid;
  real_pilot boolean;
begin
  select site_id, real_operator_pilot
    into target_site, real_pilot
    from public.operator_pilot_workspaces
    where id = p_workspace_id;
  if not found or not real_pilot then
    raise exception 'A real operator pilot workspace is required';
  end if;
  if public.get_assessment_role(target_site)
     not in ('operator_reviewer','workspace_admin') then
    raise exception 'Operator reviewer required';
  end if;
  update public.grid_shadow_validation_runs
    set workspace_id = p_workspace_id
    where id = p_shadow_run_id and workspace_id is null;
  if not found then
    raise exception 'Unlinked shadow run required';
  end if;
  return 'workspace_attached';
end $$;

revoke all on function public.attach_release3_shadow_run_to_workspace(uuid,uuid)
  from public,anon;
grant execute on function public.attach_release3_shadow_run_to_workspace(uuid,uuid)
  to authenticated;

create or replace function public.approve_release3_internal_champion(
  p_shadow_run_id uuid,
  p_model_review_id uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  run public.grid_shadow_validation_runs%rowtype;
  review public.operator_model_reviews%rowtype;
  workspace public.operator_pilot_workspaces%rowtype;
  reconciliation public.operator_model_reconciliations%rowtype;
  training_allowed boolean;
  event_digest text;
begin
  select * into run from public.grid_shadow_validation_runs
    where id = p_shadow_run_id for update;
  if not found or run.workspace_id is null then
    raise exception 'Operator workspace required';
  end if;
  select * into workspace from public.operator_pilot_workspaces
    where id = run.workspace_id;
  if not found or not workspace.real_operator_pilot then
    raise exception 'Real operator pilot required';
  end if;
  if public.get_assessment_role(workspace.site_id)
     not in ('operator_reviewer','workspace_admin') then
    raise exception 'Operator reviewer required';
  end if;
  select * into review from public.operator_model_reviews
    where id = p_model_review_id;
  if not found or review.workspace_id <> run.workspace_id
     or review.review_status not in ('reviewed','confirmed')
     or review.reconciliation_id is null then
    raise exception 'Matching operator model review required';
  end if;
  select * into reconciliation from public.operator_model_reconciliations
    where id = review.reconciliation_id and workspace_id = run.workspace_id;
  if not found or reconciliation.status <> 'passed' then
    raise exception 'Passed operator-model reconciliation required';
  end if;
  select exists(
    select 1 from public.operator_pilot_agreements
    where workspace_id = run.workspace_id and agreement_type = 'data_use'
      and status = 'signed'
      and coalesce(scope->>'model_training_allowed','false') = 'true'
      and (effective_from is null or effective_from <= current_date)
      and (effective_to is null or effective_to >= current_date)
  ) into training_allowed;
  if workspace.validation_class not in ('operator_model_reconciled','operator_reviewed')
     or not run.technical_gates_passed or not training_allowed then
    raise exception 'Validation, technical gates, and current signed training permission required';
  end if;
  update public.grid_shadow_validation_runs
    set validation_class = workspace.validation_class,
        decision = 'approve_internal_champion', status = 'approved'
    where id = p_shadow_run_id;
  event_digest := encode(extensions.digest(
    p_shadow_run_id::text || p_model_review_id::text || run.model_dataset_hash
      || reconciliation.result_sha256 || now()::text,
    'sha256'
  ),'hex');
  insert into public.grid_champion_history(
    shadow_run_id,model_dataset_hash,prior_status,next_status,
    operator_review_id,actor_id,reason,event_sha256
  ) values (
    p_shadow_run_id,run.model_dataset_hash,'challenger','internal_champion',
    p_model_review_id,auth.uid(),
    'operator_review_reconciliation_permission_and_technical_gates_passed',event_digest
  );
  return 'internal_champion';
end $$;

revoke all on function public.approve_release3_internal_champion(uuid,uuid)
  from public,anon;
grant execute on function public.approve_release3_internal_champion(uuid,uuid)
  to authenticated;
