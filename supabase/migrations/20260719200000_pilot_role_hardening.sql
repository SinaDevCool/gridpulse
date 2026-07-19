-- Pilot hardening: semantic project roles, signed approvals and enforceable separation of duties.

update public.assessment_collaborators set role = 'workspace_admin' where role = 'editor';

alter table public.assessment_collaborators drop constraint if exists assessment_collaborators_role_check;
alter table public.assessment_collaborators add constraint assessment_collaborators_role_check
  check (role in ('viewer','customer_contributor','technical_reviewer','commercial_reviewer','grid_expert','workspace_admin'));

alter table public.assessment_reviews
  add column if not exists assigned_to_email text,
  add column if not exists due_at timestamptz,
  add column if not exists signer_name text,
  add column if not exists signer_email text,
  add column if not exists signed_at timestamptz,
  add column if not exists signature_method text,
  add column if not exists content_hash text;

alter table public.assessment_milestones drop constraint if exists assessment_milestones_milestone_type_check;
alter table public.assessment_milestones add constraint assessment_milestones_milestone_type_check
  check (milestone_type in ('internal','operator_deadline','submission','meeting','energization','strategy_execution','operator_response','review_deadline'));

create or replace function public.get_assessment_role(p_site_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.candidate_sites s where s.id = p_site_id and s.user_id = (select auth.uid()))
      then 'workspace_admin'
    else coalesce((
      select c.role from public.assessment_collaborators c
      where c.site_id = p_site_id and c.accepted_by = (select auth.uid())
      limit 1
    ), 'none')
  end;
$$;
revoke all on function public.get_assessment_role(uuid) from public;
grant execute on function public.get_assessment_role(uuid) to authenticated;

create or replace function public.can_edit_assessment(p_site_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.get_assessment_role(p_site_id) in
    ('customer_contributor','technical_reviewer','commercial_reviewer','grid_expert','workspace_admin');
$$;

create or replace function public.record_assessment_approval(
  p_site_id uuid,
  p_role text,
  p_subject_type text,
  p_subject_id text,
  p_note text,
  p_content_hash text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor_role text;
  actor_email text;
  actor_name text;
  review_id uuid;
begin
  actor_role := public.get_assessment_role(p_site_id);
  if actor_role <> p_role or p_role not in ('technical_reviewer','commercial_reviewer','grid_expert','workspace_admin') then
    raise exception 'The authenticated project role may not issue this approval.';
  end if;

  actor_email := coalesce((select auth.jwt()->>'email'), 'authenticated-user');
  actor_name := coalesce((select auth.jwt()->'user_metadata'->>'full_name'), actor_email);

  insert into public.assessment_reviews (
    site_id, user_id, role, subject_type, subject_id, status, note, resolved_at,
    signer_name, signer_email, signed_at, signature_method, content_hash
  ) values (
    p_site_id, (select auth.uid()), p_role, p_subject_type, p_subject_id, 'accepted', p_note, now(),
    actor_name, actor_email, now(), 'authenticated_account', p_content_hash
  ) returning id into review_id;

  return review_id;
end;
$$;
revoke all on function public.record_assessment_approval(uuid,text,text,text,text,text) from public;
grant execute on function public.record_assessment_approval(uuid,text,text,text,text,text) to authenticated;

drop policy if exists "editors manage assessment reviews" on public.assessment_reviews;
create policy "participants create open review items" on public.assessment_reviews
for insert to authenticated with check (
  public.can_edit_assessment(site_id) and status in ('open','challenged')
);
create policy "participants update unresolved review items" on public.assessment_reviews
for update to authenticated using (
  public.can_edit_assessment(site_id) and status in ('open','challenged')
) with check (
  public.can_edit_assessment(site_id) and status in ('open','challenged')
);
create policy "participants delete unresolved review items" on public.assessment_reviews
for delete to authenticated using (
  public.can_edit_assessment(site_id) and status in ('open','challenged')
);

comment on function public.record_assessment_approval(uuid,text,text,text,text,text)
  is 'Creates an authenticated signed approval only when the caller actually holds the requested project role.';
