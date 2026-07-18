-- Keep the pilot audit trail concise and human-readable.

create or replace function public.log_assessment_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  row_data jsonb;
  record_id uuid;
  assessment_id uuid;
  action text;
  action_label text;
  entity_label text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  record_id := (row_data->>'id')::uuid;
  assessment_id := coalesce((row_data->>'site_id')::uuid, record_id);
  action := lower(tg_op);
  action_label := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  entity_label := case tg_table_name
    when 'candidate_sites' then 'Assessment'
    when 'assessment_documents' then 'Document'
    when 'assessment_evidence' then 'Evidence item'
    when 'operator_requirements' then 'Operator requirement'
    when 'assessment_milestones' then 'Milestone'
    when 'operator_correspondence' then 'Operator interaction'
    when 'decision_memos' then 'Decision memo snapshot'
    else initcap(replace(tg_table_name, '_', ' '))
  end;

  insert into public.assessment_activity (
    site_id, actor_id, event_type, entity_type, entity_id, summary, details
  ) values (
    assessment_id,
    (select auth.uid()),
    action,
    tg_table_name,
    record_id,
    entity_label || ' ' || action_label,
    jsonb_build_object('operation', tg_op)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists operator_requirements_activity on public.operator_requirements;
create trigger operator_requirements_activity after update or delete on public.operator_requirements
for each row execute function public.log_assessment_change();
