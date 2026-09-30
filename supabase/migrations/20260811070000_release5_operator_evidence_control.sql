-- Release 5 completion: only the atomic, grid-expert controlled workflow may
-- promote reviewed extraction evidence or create an operator-proposed envelope.

drop policy if exists "editors manage integration events" on public.integration_events;
create policy "editors insert unconfirmed integration events"
  on public.integration_events for insert to authenticated
  with check (public.can_edit_assessment(site_id) and evidence_state in ('declared','reviewed'));
create policy "editors update unconfirmed integration events"
  on public.integration_events for update to authenticated
  using (public.can_edit_assessment(site_id) and evidence_state in ('declared','reviewed'))
  with check (public.can_edit_assessment(site_id) and evidence_state in ('declared','reviewed'));
create policy "editors delete unconfirmed integration events"
  on public.integration_events for delete to authenticated
  using (public.can_edit_assessment(site_id) and evidence_state in ('declared','reviewed'));

drop policy if exists "owners manage fca envelopes" on public.fca_envelopes;
drop policy if exists "collaborator editors manage envelopes" on public.fca_envelopes;
create policy "editors insert unconfirmed envelopes"
  on public.fca_envelopes for insert to authenticated
  with check (
    public.can_edit_assessment(site_id)
    and user_id = (select auth.uid())
    and status in ('draft','submitted')
  );
create policy "editors update non-confirmed envelopes"
  on public.fca_envelopes for update to authenticated
  using (public.can_edit_assessment(site_id))
  with check (
    public.can_edit_assessment(site_id)
    and status in ('draft','submitted','superseded','expired')
  );
create policy "editors delete non-confirmed envelopes"
  on public.fca_envelopes for delete to authenticated
  using (public.can_edit_assessment(site_id) and status in ('draft','submitted'));

create or replace function public.approve_release5_operator_evidence(
  p_event_id uuid,
  p_document_id uuid,
  p_source_sha256 text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  evidence public.integration_events%rowtype;
  source_document public.assessment_documents%rowtype;
  approved_facts jsonb;
  review_id uuid;
  envelope_id uuid;
  import_mw numeric;
  export_mw numeric;
  mode_value text;
  valid_from_value timestamptz;
  valid_to_value timestamptz;
begin
  select * into evidence from public.integration_events where id = p_event_id for update;
  if not found or evidence.kind <> 'capacity_evidence' or evidence.evidence_state <> 'reviewed' then
    raise exception 'Reviewed capacity-evidence event required';
  end if;
  if public.get_assessment_role(evidence.site_id) <> 'grid_expert' then
    raise exception 'Authenticated grid-expert role required';
  end if;
  select * into source_document from public.assessment_documents where id = p_document_id;
  if not found or source_document.site_id <> evidence.site_id
     or source_document.source_classification <> 'operator_source' then
    raise exception 'Linked operator-source document required';
  end if;
  if p_source_sha256 !~ '^[a-f0-9]{64}$'
     or evidence.payload->>'sourceDocumentId' <> p_document_id::text
     or evidence.payload->>'sourceDocumentSha256' <> p_source_sha256 then
    raise exception 'Exact source-document hash linkage required';
  end if;
  if evidence.payload->>'reviewerStatement' is null
     or jsonb_typeof(evidence.payload->'discrepancies') <> 'array'
     or jsonb_array_length(evidence.payload->'discrepancies') < 3
     or jsonb_typeof(evidence.payload->'declaredValues') <> 'object' then
    raise exception 'Human review and discrepancy-preservation record required';
  end if;
  approved_facts := evidence.payload->'facts';
  if jsonb_typeof(approved_facts) <> 'object' then raise exception 'Reviewed facts required'; end if;
  import_mw := nullif(approved_facts->>'importLimitMw','')::numeric;
  export_mw := nullif(approved_facts->>'exportLimitMw','')::numeric;
  if (import_mw is null and export_mw is null) or coalesce(import_mw,0) < 0
     or coalesce(export_mw,0) < 0 then raise exception 'A valid non-negative limit is required'; end if;
  mode_value := case approved_facts->>'flexibilityMode'
    when 'scheduled' then 'scheduled' when 'dynamic' then 'dynamic' else 'static' end;
  valid_from_value := nullif(approved_facts->>'validFrom','')::date;
  valid_to_value := nullif(approved_facts->>'validTo','')::date;
  if valid_to_value is not null and valid_from_value is not null
     and valid_to_value <= valid_from_value then raise exception 'Invalid evidence validity window'; end if;

  insert into public.assessment_reviews(
    site_id,user_id,role,subject_type,subject_id,status,note,resolved_at,
    signer_name,signer_email,signed_at,signature_method,content_hash
  ) values (
    evidence.site_id,(select auth.uid()),'grid_expert','operator_capacity_evidence',
    p_document_id::text,'accepted','Authenticated grid-expert approval of reviewed extraction.',now(),
    coalesce((select auth.jwt()->'user_metadata'->>'full_name'),(select auth.jwt()->>'email'),'authenticated-user'),
    coalesce((select auth.jwt()->>'email'),'authenticated-user'),now(),
    'authenticated_account',p_source_sha256
  ) returning id into review_id;

  update public.integration_events set evidence_state = 'operator_confirmed'
    where id = p_event_id;
  insert into public.fca_envelopes(
    site_id,user_id,name,mode,max_import_mw,max_export_mw,valid_from,valid_to,
    status,source_document_id,restriction_schedule,notes
  ) values (
    evidence.site_id,(select auth.uid()),'Grid-expert reviewed operator proposal',mode_value,
    import_mw,export_mw,valid_from_value,valid_to_value,'operator_proposed',p_document_id,
    jsonb_build_object(
      'noticeMinutes',approved_facts->'noticeMinutes',
      'signals',coalesce(approved_facts->'signals','[]'::jsonb),
      'source','authenticated_grid_expert_review',
      'source_sha256',p_source_sha256,
      'review_id',review_id
    ),
    'Reviewed customer-side record; not a connection offer, dispatch instruction or public capacity.'
  ) returning id into envelope_id;
  return envelope_id;
end $$;

revoke all on function public.approve_release5_operator_evidence(uuid,uuid,text)
  from public,anon;
grant execute on function public.approve_release5_operator_evidence(uuid,uuid,text)
  to authenticated;
