-- Phase 5: pilot intake linkage, immutable decision memos, and a workspace audit trail.

alter table public.candidate_sites
  add column if not exists postcode text check (postcode is null or postcode ~ '^\d{5}$'),
  add column if not exists municipality text,
  add column if not exists federal_state text,
  add column if not exists connection_challenge text,
  add column if not exists intake_source text not null default 'workspace'
    check (intake_source in ('workspace','pilot_request')),
  add column if not exists pilot_request_id uuid references public.pilot_requests(id) on delete set null;

create unique index if not exists candidate_sites_pilot_request_unique
  on public.candidate_sites(pilot_request_id) where pilot_request_id is not null;

create table public.assessment_activity (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null check (char_length(summary) between 2 and 300),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.decision_memos (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null,
  readiness_score integer not null check (readiness_score between 0 and 100),
  workflow_status text not null,
  recommended_next_action text not null,
  blockers jsonb not null default '[]'::jsonb,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(site_id, version)
);

create or replace function public.assign_decision_memo_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.site_id::text, 0));
  if new.version is null or new.version < 1 then
    select coalesce(max(version), 0) + 1 into new.version
    from public.decision_memos where site_id = new.site_id;
  end if;
  return new;
end;
$$;

create trigger decision_memos_assign_version before insert on public.decision_memos
for each row execute function public.assign_decision_memo_version();

alter table public.assessment_activity enable row level security;
alter table public.decision_memos enable row level security;

create policy "participants read activity" on public.assessment_activity
for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors create activity" on public.assessment_activity
for insert to authenticated with check (public.can_edit_assessment(site_id));

create policy "participants read decision memos" on public.decision_memos
for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors create decision memos" on public.decision_memos
for insert to authenticated with check (public.can_edit_assessment(site_id));

create index assessment_activity_site_created_idx
  on public.assessment_activity(site_id, created_at desc);
create index decision_memos_site_version_idx
  on public.decision_memos(site_id, version desc);

create or replace function public.log_assessment_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  row_data jsonb;
  record_id uuid;
  assessment_id uuid;
  action text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  record_id := (row_data->>'id')::uuid;
  assessment_id := coalesce((row_data->>'site_id')::uuid, record_id);
  action := lower(tg_op);

  insert into public.assessment_activity (
    site_id, actor_id, event_type, entity_type, entity_id, summary, details
  ) values (
    assessment_id,
    (select auth.uid()),
    action,
    tg_table_name,
    record_id,
    initcap(replace(tg_table_name, '_', ' ')) || ' ' || action || 'd',
    jsonb_build_object('operation', tg_op)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger candidate_sites_activity after insert or update on public.candidate_sites
for each row execute function public.log_assessment_change();
create trigger assessment_documents_activity after insert or update or delete on public.assessment_documents
for each row execute function public.log_assessment_change();
create trigger assessment_evidence_activity after insert or update or delete on public.assessment_evidence
for each row execute function public.log_assessment_change();
create trigger operator_requirements_activity after insert or update or delete on public.operator_requirements
for each row execute function public.log_assessment_change();
create trigger assessment_milestones_activity after insert or update or delete on public.assessment_milestones
for each row execute function public.log_assessment_change();
create trigger operator_correspondence_activity after insert or update or delete on public.operator_correspondence
for each row execute function public.log_assessment_change();
create trigger decision_memos_activity after insert on public.decision_memos
for each row execute function public.log_assessment_change();
