-- Fix operator-profile screening and keep delete cascades compatible with RLS.

drop trigger if exists assessment_documents_activity on public.assessment_documents;
create trigger assessment_documents_activity after insert or update on public.assessment_documents
for each row execute function public.log_assessment_change();

drop trigger if exists assessment_evidence_activity on public.assessment_evidence;
create trigger assessment_evidence_activity after insert or update on public.assessment_evidence
for each row execute function public.log_assessment_change();

drop trigger if exists operator_requirements_activity on public.operator_requirements;
create trigger operator_requirements_activity after update on public.operator_requirements
for each row execute function public.log_assessment_change();

drop trigger if exists assessment_milestones_activity on public.assessment_milestones;
create trigger assessment_milestones_activity after insert or update on public.assessment_milestones
for each row execute function public.log_assessment_change();

drop trigger if exists operator_correspondence_activity on public.operator_correspondence;
create trigger operator_correspondence_activity after insert or update on public.operator_correspondence
for each row execute function public.log_assessment_change();

create or replace function public.apply_operator_profile(p_site_id uuid, p_profile_key text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile public.operator_profiles%rowtype;
begin
  select * into profile from public.operator_profiles where key = p_profile_key;
  if not found then raise exception 'Unknown operator profile'; end if;

  update public.candidate_sites
  set operator_profile_key = profile.key,
      likely_network_operator = profile.operator_name,
      operator_confirmation_status = 'screening_only',
      operator_status = 'screening'
  where id = p_site_id and user_id = (select auth.uid());
  if not found then raise exception 'Assessment not found or not owned by current user'; end if;

  insert into public.operator_requirements (
    site_id, user_id, requirement_key, label, category, sort_order, profile_key, source_url
  )
  select p_site_id, (select auth.uid()), item->>'key', item->>'label', item->>'category',
    (item->>'sort_order')::integer, profile.key, profile.application_url
  from jsonb_array_elements(profile.requirement_template) item
  on conflict (site_id, requirement_key) do update set
    label = excluded.label,
    category = excluded.category,
    sort_order = excluded.sort_order,
    profile_key = excluded.profile_key,
    source_url = excluded.source_url;
end;
$$;
