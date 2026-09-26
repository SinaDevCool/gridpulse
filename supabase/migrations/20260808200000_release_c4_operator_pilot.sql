-- Release C4: private operator data room, reconciliation, review and audit trail.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'operator-data-room', 'operator-data-room', false, 524288000,
  array['application/xml','text/xml','application/zip','text/csv','application/json','application/pdf']
) on conflict (id) do update set public = false;

create table public.operator_pilot_workspaces (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.candidate_sites(id) on delete cascade,
  operator_id uuid references public.grid_operators(id) on delete restrict,
  pilot_name text not null,
  substation_name text,
  substation_identifier text,
  status text not null default 'data_requested' check (status in (
    'data_requested','data_received','validation_failed','model_unvalidated',
    'model_reconciled','operator_review','operator_reviewed','operator_confirmed','closed'
  )),
  validation_class text not null default 'operator_model_unvalidated' check (validation_class in (
    'operator_model_unvalidated','operator_model_reconciled','operator_reviewed','operator_confirmed'
  )),
  real_operator_pilot boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operator_data_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  package_type text not null check (package_type in ('cgmes','scada','ratings','contingencies','agreement')),
  version text not null,
  storage_prefix text not null,
  package_sha256 text not null check (package_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  status text not null default 'uploaded' check (status in ('uploaded','validating','accepted','rejected','superseded')),
  validation_report jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id, package_type, version),
  unique(workspace_id, package_sha256)
);

create table public.operator_model_reconciliations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  model_package_id uuid not null references public.operator_data_packages(id),
  scada_package_id uuid not null references public.operator_data_packages(id),
  result_sha256 text not null check (result_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('passed','failed')),
  metrics jsonb not null,
  thresholds jsonb not null,
  report jsonb not null,
  executed_by uuid references auth.users(id),
  executed_at timestamptz not null default now(),
  unique(workspace_id, result_sha256)
);

create table public.operator_pilot_agreements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  agreement_type text not null check (agreement_type in ('data_use','model_review','capacity_representation','pilot_scope')),
  status text not null default 'draft' check (status in ('draft','sent','signed','expired','terminated')),
  document_package_id uuid references public.operator_data_packages(id),
  document_sha256 text check (document_sha256 is null or document_sha256 ~ '^[a-f0-9]{64}$'),
  effective_from date,
  effective_to date,
  operator_signer_name text,
  operator_signer_organisation text,
  signed_at timestamptz,
  scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'signed' or (document_sha256 is not null and signed_at is not null and operator_signer_organisation is not null))
);

create table public.operator_model_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  reconciliation_id uuid references public.operator_model_reconciliations(id),
  review_status text not null check (review_status in ('changes_requested','reviewed','confirmed','withdrawn')),
  scope text not null,
  findings jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  reviewer_id uuid not null default auth.uid() references auth.users(id),
  reviewer_organisation text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  signed_at timestamptz not null default now()
);

create table public.operator_pilot_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete restrict,
  actor_id uuid references auth.users(id),
  actor_role text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  previous_event_hash text,
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now()
);

create index operator_packages_workspace_idx on public.operator_data_packages(workspace_id, package_type, created_at desc);
create index operator_reconciliation_workspace_idx on public.operator_model_reconciliations(workspace_id, executed_at desc);
create index operator_audit_workspace_idx on public.operator_pilot_audit_events(workspace_id, id);

alter table public.operator_pilot_workspaces enable row level security;
alter table public.operator_data_packages enable row level security;
alter table public.operator_model_reconciliations enable row level security;
alter table public.operator_pilot_agreements enable row level security;
alter table public.operator_model_reviews enable row level security;
alter table public.operator_pilot_audit_events enable row level security;

grant select, insert, update on public.operator_pilot_workspaces to authenticated;
grant select, insert, update on public.operator_data_packages to authenticated;
grant select, insert on public.operator_model_reconciliations to authenticated;
grant select, insert, update on public.operator_pilot_agreements to authenticated;
grant select, insert on public.operator_model_reviews to authenticated;
grant select on public.operator_pilot_audit_events to authenticated;

create policy "participants read operator pilot" on public.operator_pilot_workspaces for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors create operator pilot" on public.operator_pilot_workspaces for insert to authenticated with check (public.can_edit_assessment(site_id));
create policy "reviewers update operator pilot" on public.operator_pilot_workspaces for update to authenticated using (public.get_assessment_role(site_id) in ('operator_reviewer','grid_expert','workspace_admin'));
create policy "participants read operator packages" on public.operator_data_packages for select to authenticated using (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.can_read_assessment(w.site_id)));
create policy "reviewers manage operator packages" on public.operator_data_packages for all to authenticated using (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.get_assessment_role(w.site_id) in ('operator_reviewer','grid_expert','workspace_admin'))) with check (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.get_assessment_role(w.site_id) in ('operator_reviewer','grid_expert','workspace_admin')));
create policy "participants read reconciliations" on public.operator_model_reconciliations for select to authenticated using (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.can_read_assessment(w.site_id)));
create policy "reviewers insert reconciliations" on public.operator_model_reconciliations for insert to authenticated with check (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.get_assessment_role(w.site_id) in ('operator_reviewer','grid_expert','workspace_admin')));
create policy "participants read pilot agreements" on public.operator_pilot_agreements for select to authenticated using (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.can_read_assessment(w.site_id)));
create policy "operator reviewers manage agreements" on public.operator_pilot_agreements for all to authenticated using (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.get_assessment_role(w.site_id) in ('operator_reviewer','workspace_admin'))) with check (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.get_assessment_role(w.site_id) in ('operator_reviewer','workspace_admin')));
create policy "participants read model reviews" on public.operator_model_reviews for select to authenticated using (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.can_read_assessment(w.site_id)));
create policy "operator reviewers sign reviews" on public.operator_model_reviews for insert to authenticated with check (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.get_assessment_role(w.site_id)='operator_reviewer'));
create policy "participants read operator audit" on public.operator_pilot_audit_events for select to authenticated using (exists(select 1 from public.operator_pilot_workspaces w where w.id=workspace_id and public.can_read_assessment(w.site_id)));

create policy "operator room read" on storage.objects for select to authenticated using (
  bucket_id='operator-data-room' and exists(select 1 from public.operator_pilot_workspaces w where w.id=((storage.foldername(name))[1])::uuid and public.can_read_assessment(w.site_id))
);
create policy "operator room upload" on storage.objects for insert to authenticated with check (
  bucket_id='operator-data-room' and exists(select 1 from public.operator_pilot_workspaces w where w.id=((storage.foldername(name))[1])::uuid and public.get_assessment_role(w.site_id) in ('operator_reviewer','grid_expert','workspace_admin'))
);

create or replace function public.record_operator_pilot_event(p_workspace_id uuid, p_event_type text, p_entity_type text, p_entity_id text, p_payload jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare prior_hash text; next_hash text; event_id bigint; site uuid;
begin
  select site_id into site from public.operator_pilot_workspaces where id=p_workspace_id;
  if site is null or not public.can_read_assessment(site) then raise exception 'Access denied'; end if;
  select event_hash into prior_hash from public.operator_pilot_audit_events where workspace_id=p_workspace_id order by id desc limit 1;
  next_hash := encode(extensions.digest(coalesce(prior_hash,'') || p_event_type || p_entity_type || p_entity_id || coalesce(p_payload,'{}'::jsonb)::text || now()::text, 'sha256'),'hex');
  insert into public.operator_pilot_audit_events(workspace_id,actor_id,actor_role,event_type,entity_type,entity_id,payload,previous_event_hash,event_hash)
  values(p_workspace_id,auth.uid(),public.get_assessment_role(site),p_event_type,p_entity_type,p_entity_id,coalesce(p_payload,'{}'::jsonb),prior_hash,next_hash) returning id into event_id;
  return event_id;
end $$;
revoke all on function public.record_operator_pilot_event(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.record_operator_pilot_event(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.promote_operator_pilot(p_workspace_id uuid, p_target_status text)
returns text language plpgsql security definer set search_path='' as $$
declare w public.operator_pilot_workspaces%rowtype; rec_ok boolean; review_ok boolean; agreement_ok boolean;
begin
  select * into w from public.operator_pilot_workspaces where id=p_workspace_id for update;
  if not found or public.get_assessment_role(w.site_id) not in ('operator_reviewer','workspace_admin') then raise exception 'Operator reviewer required'; end if;
  select exists(select 1 from public.operator_model_reconciliations where workspace_id=p_workspace_id and status='passed') into rec_ok;
  select exists(select 1 from public.operator_model_reviews where workspace_id=p_workspace_id and review_status in ('reviewed','confirmed')) into review_ok;
  select exists(select 1 from public.operator_pilot_agreements where workspace_id=p_workspace_id and agreement_type='capacity_representation' and status='signed') into agreement_ok;
  if p_target_status='operator_reviewed' and not(rec_ok and review_ok) then raise exception 'Passing reconciliation and signed review required'; end if;
  if p_target_status='operator_confirmed' and not(rec_ok and review_ok and agreement_ok and w.real_operator_pilot) then raise exception 'Real pilot, reconciliation, review, and signed representation agreement required'; end if;
  update public.operator_pilot_workspaces set status=p_target_status,validation_class=case when p_target_status='operator_confirmed' then 'operator_confirmed' when p_target_status='operator_reviewed' then 'operator_reviewed' else validation_class end,updated_at=now() where id=p_workspace_id;
  perform public.record_operator_pilot_event(p_workspace_id,'status_promoted','workspace',p_workspace_id::text,jsonb_build_object('target_status',p_target_status));
  return p_target_status;
end $$;
revoke all on function public.promote_operator_pilot(uuid,text) from public,anon;
grant execute on function public.promote_operator_pilot(uuid,text) to authenticated;

create or replace function public.prevent_operator_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'Operator pilot audit events are immutable'; end $$;
create trigger operator_audit_immutable before update or delete on public.operator_pilot_audit_events for each row execute function public.prevent_operator_audit_mutation();
