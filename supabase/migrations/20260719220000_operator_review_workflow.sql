-- Authenticated network-operator review with signed, append-only decisions.

alter table public.assessment_collaborators drop constraint if exists assessment_collaborators_role_check;
alter table public.assessment_collaborators add constraint assessment_collaborators_role_check
  check (role in ('viewer','customer_contributor','technical_reviewer','commercial_reviewer','grid_expert','operator_reviewer','workspace_admin'));

alter table public.assessment_documents drop constraint if exists assessment_documents_document_type_check;
alter table public.assessment_documents add constraint assessment_documents_document_type_check check (document_type in (
  'project_brief','site_plan','single_line_diagram','technical_specification','load_profile',
  'operator_correspondence','connection_offer','capacity_statement','technical_study','fca_schedule','other'
));

create or replace function public.can_read_network_record(p_site_id uuid, p_confidentiality text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_read_assessment(p_site_id) and case p_confidentiality
    when 'public_context' then true
    when 'project_participants' then true
    when 'reviewers' then public.get_assessment_role(p_site_id) in ('technical_reviewer','commercial_reviewer','grid_expert','operator_reviewer','workspace_admin')
    when 'operator_restricted' then public.get_assessment_role(p_site_id) in ('grid_expert','operator_reviewer','workspace_admin')
    else false
  end;
$$;

create table public.operator_decisions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  node_id uuid not null references public.network_nodes(id) on delete cascade,
  candidate_snapshot_id uuid references public.capacity_snapshots(id) on delete set null,
  confirmed_snapshot_id uuid references public.capacity_snapshots(id) on delete set null,
  source_document_id uuid references public.assessment_documents(id) on delete restrict,
  decision text not null check (decision in ('confirmed','rejected','changes_requested')),
  statement_scope text not null default 'planning_statement'
    check (statement_scope in ('planning_statement','capacity_statement','contractual_commitment')),
  note text not null check (char_length(note) between 2 and 2000),
  requested_changes jsonb not null default '[]'::jsonb,
  node_corrections jsonb not null default '{}'::jsonb,
  valid_from timestamptz,
  valid_to timestamptz,
  signer_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  signer_name text not null,
  signer_email text not null,
  signer_organization text not null,
  signed_at timestamptz not null default now(),
  signature_method text not null default 'authenticated_account',
  content_hash text not null,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to > valid_from),
  check (decision <> 'confirmed' or source_document_id is not null)
);

alter table public.operator_decisions enable row level security;
create policy "participants read operator decisions" on public.operator_decisions for select to authenticated
using (public.can_read_assessment(site_id));
revoke all on table public.operator_decisions from anon;

create policy "operator reviewers upload source document records" on public.assessment_documents
for insert to authenticated with check (
  public.get_assessment_role(site_id) = 'operator_reviewer'
  and user_id = (select auth.uid())
  and source_classification = 'operator_source'
  and document_type in ('operator_response','connection_offer','capacity_statement','technical_study','other')
);

create policy "operator reviewers upload source files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'assessment-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and public.get_assessment_role(((storage.foldername(name))[2])::uuid) = 'operator_reviewer'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.record_operator_node_decision(
  p_site_id uuid,
  p_node_id uuid,
  p_candidate_snapshot_id uuid,
  p_source_document_id uuid,
  p_decision text,
  p_statement_scope text,
  p_note text,
  p_requested_changes jsonb,
  p_node_corrections jsonb,
  p_valid_from timestamptz,
  p_valid_to timestamptz,
  p_signer_organization text,
  p_content_hash text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_role text;
  actor_email text;
  actor_name text;
  decision_id uuid;
  confirmed_id uuid;
  candidate public.capacity_snapshots%rowtype;
begin
  actor_role := public.get_assessment_role(p_site_id);
  if actor_role <> 'operator_reviewer' then
    raise exception 'Only the authenticated operator reviewer may issue an operator decision.';
  end if;
  if p_decision not in ('confirmed','rejected','changes_requested') then raise exception 'Invalid decision.'; end if;
  if p_statement_scope not in ('planning_statement','capacity_statement','contractual_commitment') then raise exception 'Invalid statement scope.'; end if;
  if char_length(trim(p_note)) < 2 then raise exception 'A decision note is required.'; end if;
  if char_length(trim(p_signer_organization)) < 2 then raise exception 'The signer organization is required.'; end if;
  if char_length(trim(p_content_hash)) < 16 then raise exception 'A content hash is required.'; end if;
  if p_valid_to is not null and p_valid_from is not null and p_valid_to <= p_valid_from then raise exception 'The validity end must follow the start.'; end if;
  if not exists (select 1 from public.network_nodes n where n.id = p_node_id and n.site_id = p_site_id) then raise exception 'Node does not belong to this project.'; end if;

  if p_source_document_id is not null and not exists (
    select 1 from public.assessment_documents d
    where d.id = p_source_document_id and d.site_id = p_site_id and d.source_classification = 'operator_source'
  ) then raise exception 'The source document must be an operator-source document for this project.'; end if;

  if p_decision = 'confirmed' then
    if p_source_document_id is null then raise exception 'Confirmation requires an operator-source document.'; end if;
    select * into candidate from public.capacity_snapshots
      where id = p_candidate_snapshot_id and site_id = p_site_id and node_id = p_node_id;
    if not found then raise exception 'A candidate capacity snapshot is required for confirmation.'; end if;

    insert into public.capacity_snapshots (
      site_id,node_id,study_run_id,capacity_kind,firm_import_mw,firm_export_mw,
      conditional_import_mw,conditional_export_mw,known_commitments_mw,queued_capacity_mw,
      network_state,time_resolution_minutes,conditional_envelope,methodology_version,
      observed_at,valid_from,valid_to,status,source_classification,confidence,confidentiality,
      source_document_id,notes,created_by
    ) values (
      p_site_id,p_node_id,candidate.study_run_id,
      case when p_statement_scope = 'contractual_commitment' then 'contractual_limit' else 'operator_statement' end,
      candidate.firm_import_mw,candidate.firm_export_mw,candidate.conditional_import_mw,candidate.conditional_export_mw,
      candidate.known_commitments_mw,candidate.queued_capacity_mw,candidate.network_state,
      candidate.time_resolution_minutes,candidate.conditional_envelope,candidate.methodology_version,
      now(),p_valid_from,p_valid_to,'operator_confirmed','operator_statement','operator_confirmed',
      'operator_restricted',p_source_document_id,p_note,(select auth.uid())
    ) returning id into confirmed_id;

    update public.network_nodes set
      node_name = coalesce(nullif(p_node_corrections->>'node_name',''), node_name),
      node_code = coalesce(nullif(p_node_corrections->>'node_code',''), node_code),
      operator_name = coalesce(nullif(p_node_corrections->>'operator_name',''), operator_name),
      voltage_kv = coalesce(nullif(p_node_corrections->>'voltage_kv','')::numeric, voltage_kv),
      source_classification = 'operator_statement', confidence = 'operator_confirmed',
      source_document_id = p_source_document_id
    where id = p_node_id and site_id = p_site_id;
  end if;

  actor_email := coalesce((select auth.jwt()->>'email'), 'authenticated-user');
  actor_name := coalesce((select auth.jwt()->'user_metadata'->>'full_name'), actor_email);
  insert into public.operator_decisions (
    site_id,node_id,candidate_snapshot_id,confirmed_snapshot_id,source_document_id,
    decision,statement_scope,note,requested_changes,node_corrections,valid_from,valid_to,
    signer_id,signer_name,signer_email,signer_organization,content_hash
  ) values (
    p_site_id,p_node_id,p_candidate_snapshot_id,confirmed_id,p_source_document_id,
    p_decision,p_statement_scope,p_note,coalesce(p_requested_changes,'[]'::jsonb),
    coalesce(p_node_corrections,'{}'::jsonb),p_valid_from,p_valid_to,(select auth.uid()),
    actor_name,actor_email,trim(p_signer_organization),p_content_hash
  ) returning id into decision_id;
  return decision_id;
end;
$$;
revoke all on function public.record_operator_node_decision(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,timestamptz,timestamptz,text,text) from public;
grant execute on function public.record_operator_node_decision(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,timestamptz,timestamptz,text,text) to authenticated;

create index operator_decisions_site_created_idx on public.operator_decisions(site_id, created_at desc);
create index operator_decisions_node_created_idx on public.operator_decisions(node_id, created_at desc);
create trigger operator_decisions_activity after insert on public.operator_decisions
for each row execute function public.log_assessment_change();

comment on table public.operator_decisions is 'Append-only authenticated operator review record. Confirmation creates a new operator-confirmed capacity snapshot and never rewrites the candidate evidence.';
