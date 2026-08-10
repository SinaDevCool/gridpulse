-- Release 4 completion: graph studies are created unlinked. Only an authorised
-- operator reviewer can attach and promote them against reconciled evidence.

create or replace function public.attach_release4_graph_study_to_workspace(
  p_study_id uuid,
  p_workspace_id uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  workspace public.operator_pilot_workspaces%rowtype;
  processing_allowed boolean;
begin
  select * into workspace from public.operator_pilot_workspaces
    where id = p_workspace_id;
  if not found or not workspace.real_operator_pilot then
    raise exception 'A real operator pilot workspace is required';
  end if;
  if public.get_assessment_role(workspace.site_id)
     not in ('operator_reviewer','workspace_admin') then
    raise exception 'Operator reviewer required';
  end if;
  select exists(
    select 1 from public.operator_pilot_agreements
    where workspace_id = p_workspace_id and agreement_type = 'data_use'
      and status = 'signed'
      and coalesce(scope->>'topology_processing_allowed','false') = 'true'
      and (effective_from is null or effective_from <= current_date)
      and (effective_to is null or effective_to >= current_date)
  ) into processing_allowed;
  if not processing_allowed then
    raise exception 'Current signed topology-processing permission required';
  end if;
  update public.grid_topology_studies
    set workspace_id = p_workspace_id, status = 'review_required'
    where id = p_study_id and workspace_id is null and capacity_claim = false;
  if not found then raise exception 'Unlinked non-capacity graph study required'; end if;
  return 'workspace_attached';
end $$;

revoke all on function public.attach_release4_graph_study_to_workspace(uuid,uuid)
  from public,anon;
grant execute on function public.attach_release4_graph_study_to_workspace(uuid,uuid)
  to authenticated;

create or replace function public.approve_release4_graph_study(
  p_study_id uuid,
  p_model_review_id uuid,
  p_requested_class text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  study public.grid_topology_studies%rowtype;
  workspace public.operator_pilot_workspaces%rowtype;
  review public.operator_model_reviews%rowtype;
  reconciliation public.operator_model_reconciliations%rowtype;
  data_use_allowed boolean;
  representation_allowed boolean;
  confirmation_created boolean;
  promotion_digest text;
begin
  if p_requested_class not in ('operator_model_reconciled','operator_reviewed','operator_confirmed') then
    raise exception 'Unsupported operator validation class';
  end if;
  select * into study from public.grid_topology_studies where id = p_study_id for update;
  if not found or study.workspace_id is null or study.capacity_claim then
    raise exception 'Linked non-capacity graph study required';
  end if;
  select * into workspace from public.operator_pilot_workspaces where id = study.workspace_id;
  if not found or not workspace.real_operator_pilot then raise exception 'Real pilot required'; end if;
  if public.get_assessment_role(workspace.site_id)
     not in ('operator_reviewer','workspace_admin') then raise exception 'Operator reviewer required'; end if;
  select * into review from public.operator_model_reviews where id = p_model_review_id;
  if not found or review.workspace_id <> study.workspace_id
     or review.review_status not in ('reviewed','confirmed') or review.reconciliation_id is null then
    raise exception 'Matching operator review required';
  end if;
  select * into reconciliation from public.operator_model_reconciliations
    where id = review.reconciliation_id and workspace_id = study.workspace_id;
  if not found or reconciliation.status <> 'passed' then
    raise exception 'Passed reconciliation required';
  end if;
  if coalesce(reconciliation.report->>'projection_sha256','') <> study.projection_sha256 then
    raise exception 'Reconciliation must reference the exact graph projection';
  end if;
  if p_requested_class = 'operator_model_reconciled'
     and workspace.validation_class not in ('operator_model_reconciled','operator_reviewed','operator_confirmed') then
    raise exception 'Workspace model has not been reconciled';
  end if;
  if p_requested_class = 'operator_reviewed'
     and workspace.validation_class not in ('operator_reviewed','operator_confirmed') then
    raise exception 'Workspace model has not been operator reviewed';
  end if;
  if coalesce((study.validation_summary->>'safe_for_prioritisation')::boolean,false) is not true
     or coalesce((study.validation_summary->>'operator_mandatory_cases_preserved')::boolean,false) is not true
     or not (study.validation_summary ? 'mandatory_recall')
     or not (study.validation_summary ? 'false_safe_rate')
     or coalesce((study.validation_summary->>'mandatory_recall')::numeric,0) <> 1
     or coalesce((study.validation_summary->>'false_safe_rate')::numeric,0) <> 0 then
    raise exception 'Complete graph and physics safety gates required';
  end if;
  select exists(
    select 1 from public.operator_pilot_agreements
    where workspace_id = study.workspace_id and agreement_type = 'data_use' and status = 'signed'
      and coalesce(scope->>'topology_processing_allowed','false') = 'true'
      and (effective_from is null or effective_from <= current_date)
      and (effective_to is null or effective_to >= current_date)
  ) into data_use_allowed;
  select exists(
    select 1 from public.operator_pilot_agreements
    where workspace_id = study.workspace_id
      and agreement_type = 'capacity_representation' and status = 'signed'
      and (effective_from is null or effective_from <= current_date)
      and (effective_to is null or effective_to >= current_date)
  ) into representation_allowed;
  if not data_use_allowed then raise exception 'Current data-use permission required'; end if;
  confirmation_created := p_requested_class = 'operator_confirmed';
  if confirmation_created and (
    not representation_allowed or review.review_status <> 'confirmed'
    or workspace.validation_class <> 'operator_confirmed'
  ) then raise exception 'Confirmed review and capacity-representation permission required'; end if;
  promotion_digest := encode(extensions.digest(
    study.study_sha256 || review.content_sha256 || reconciliation.result_sha256
      || p_requested_class || now()::text, 'sha256'
  ), 'hex');
  insert into public.grid_graph_operator_promotions(
    workspace_id,model_key,requested_class,promotion_sha256,evidence_payload,
    decision,operator_confirmation_created
  ) values (
    study.workspace_id,study.model_id || ':' || study.model_version,p_requested_class,
    promotion_digest,jsonb_build_object(
      'study_sha256',study.study_sha256,'review_id',review.id,
      'reconciliation_sha256',reconciliation.result_sha256,
      'capacity_claim',false
    ),'approved',confirmation_created
  );
  update public.grid_topology_studies set status = 'approved' where id = p_study_id;
  return case when confirmation_created then 'operator_confirmed' else p_requested_class end;
end $$;

revoke all on function public.approve_release4_graph_study(uuid,uuid,text) from public,anon;
grant execute on function public.approve_release4_graph_study(uuid,uuid,text) to authenticated;
