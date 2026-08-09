-- Release D4: complete operator package types and strengthen representation gates.

alter table public.operator_data_packages
  drop constraint if exists operator_data_packages_package_type_check;
alter table public.operator_data_packages
  add constraint operator_data_packages_package_type_check check (package_type in (
    'cgmes','scada','ratings','contingencies','agreement','switching_state',
    'planned_outages','connection_queue','reinforcements','protection'
  ));

alter table public.operator_model_reconciliations
  add column if not exists model_version text,
  add column if not exists input_sha256 text check (input_sha256 is null or input_sha256 ~ '^[a-f0-9]{64}$'),
  add column if not exists missing_data_rate numeric check (missing_data_rate is null or missing_data_rate between 0 and 1);

create or replace function public.promote_operator_pilot(p_workspace_id uuid, p_target_status text)
returns text language plpgsql security definer set search_path='' as $$
declare
  w public.operator_pilot_workspaces%rowtype;
  rec_ok boolean; review_ok boolean; representation_ok boolean; packages_ok boolean;
begin
  if p_target_status not in ('operator_reviewed','operator_confirmed') then
    raise exception 'Unsupported promotion target';
  end if;
  select * into w from public.operator_pilot_workspaces where id=p_workspace_id for update;
  if not found or public.get_assessment_role(w.site_id) not in ('operator_reviewer','workspace_admin') then
    raise exception 'Operator reviewer required';
  end if;
  select exists(
    select 1 from public.operator_model_reconciliations
    where workspace_id=p_workspace_id and status='passed'
  ) into rec_ok;
  select exists(
    select 1 from public.operator_model_reviews
    where workspace_id=p_workspace_id and review_status in ('reviewed','confirmed')
      and reviewer_organisation is not null and signed_at is not null
  ) into review_ok;
  select exists(
    select 1 from public.operator_pilot_agreements
    where workspace_id=p_workspace_id and agreement_type='capacity_representation'
      and status='signed' and document_sha256 is not null and signed_at is not null
      and coalesce((scope->>'public_representation_allowed')::boolean,false)
  ) into representation_ok;
  select count(distinct package_type) >= 4 from public.operator_data_packages
    where workspace_id=p_workspace_id and status='accepted'
      and package_type in ('cgmes','scada','ratings','contingencies')
  into packages_ok;
  if p_target_status='operator_reviewed' and not(packages_ok and rec_ok and review_ok) then
    raise exception 'Accepted core packages, passing reconciliation and signed review required';
  end if;
  if p_target_status='operator_confirmed' and not(
    packages_ok and rec_ok and review_ok and representation_ok and w.real_operator_pilot
  ) then
    raise exception 'Real pilot, accepted packages, reconciliation, review and signed representation permission required';
  end if;
  update public.operator_pilot_workspaces set
    status=p_target_status,
    validation_class=case when p_target_status='operator_confirmed' then 'operator_confirmed' else 'operator_reviewed' end,
    updated_at=now()
  where id=p_workspace_id;
  perform public.record_operator_pilot_event(
    p_workspace_id,'status_promoted','workspace',p_workspace_id::text,
    jsonb_build_object('target_status',p_target_status,'representation_permission',representation_ok)
  );
  return p_target_status;
end $$;
revoke all on function public.promote_operator_pilot(uuid,text) from public,anon;
grant execute on function public.promote_operator_pilot(uuid,text) to authenticated;

create or replace function public.verify_operator_audit_chain(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists (
    select 1 from (
      select id,previous_event_hash,lag(event_hash) over(order by id) expected_previous
      from public.operator_pilot_audit_events where workspace_id=p_workspace_id
    ) chained
    where previous_event_hash is distinct from expected_previous
  ) and exists (
    select 1 from public.operator_pilot_workspaces w
    where w.id=p_workspace_id and public.can_read_assessment(w.site_id)
  );
$$;
revoke all on function public.verify_operator_audit_chain(uuid) from public,anon;
grant execute on function public.verify_operator_audit_chain(uuid) to authenticated;
