-- Pilot execution: DSO routing, milestones, and read-only project collaboration.

alter table public.candidate_sites
  add column if not exists responsible_operator_name text,
  add column if not exists responsible_operator_level text
    check (responsible_operator_level in ('transmission','distribution')),
  add column if not exists responsibility_source text
    check (responsibility_source in ('screening','customer','operator')),
  add column if not exists responsibility_confirmed_at timestamptz;

create table public.dso_directory (
  key text primary key,
  operator_name text not null,
  coverage_summary text not null,
  website_url text not null,
  connection_url text not null,
  voltage_context text not null,
  limitation text not null,
  verified_on date not null
);
alter table public.dso_directory enable row level security;
create policy "authenticated users read DSO directory" on public.dso_directory
for select to authenticated using (true);

insert into public.dso_directory values
  ('edis','E.DIS Netz GmbH','Brandenburg and Mecklenburg-Western Pomerania','https://www.e-dis-netz.de/','https://www.e-dis-netz.de/de/energie-einspeisen/netzanschluss.html','Distribution network','Coverage is indicative; confirm the exact connection operator for the parcel.','2026-07-18'),
  ('stromnetz_berlin','Stromnetz Berlin GmbH','Berlin','https://www.stromnetz.berlin/','https://www.stromnetz.berlin/anschliessen/','Distribution network','Municipal coverage does not confirm the connection voltage or available capacity.','2026-07-18'),
  ('mitnetz','Mitteldeutsche Netzgesellschaft Strom mbH','Parts of Brandenburg, Saxony, Saxony-Anhalt and Thuringia','https://www.mitnetz-strom.de/','https://www.mitnetz-strom.de/online-services/netzanschluss','Distribution network','Coverage is indicative; verify responsibility using the operator portal.','2026-07-18'),
  ('avacon','Avacon Netz GmbH','Parts of Lower Saxony, Saxony-Anhalt, Hesse and North Rhine-Westphalia','https://www.avacon-netz.de/','https://www.avacon-netz.de/de/energie-anschliessen/netzanschluss.html','Distribution network','Coverage is indicative and may vary by municipality and voltage level.','2026-07-18'),
  ('westnetz','Westnetz GmbH','Parts of North Rhine-Westphalia, Rhineland-Palatinate and Lower Saxony','https://www.westnetz.de/','https://www.westnetz.de/de/energie-anschliessen.html','Distribution network','Coverage is indicative and does not establish a feasible connection point.','2026-07-18'),
  ('bayernwerk','Bayernwerk Netz GmbH','Large parts of Bavaria','https://www.bayernwerk-netz.de/','https://www.bayernwerk-netz.de/de/energie-anschliessen/netzanschluss.html','Distribution network','Coverage is indicative; local municipal operators may be responsible.','2026-07-18'),
  ('netze_bw','Netze BW GmbH','Large parts of Baden-Wuerttemberg','https://www.netze-bw.de/','https://www.netze-bw.de/netzanschluss','Distribution network','Coverage is indicative; confirm the parcel and voltage level.','2026-07-18'),
  ('syna','Syna GmbH','Parts of Hesse, Rhineland-Palatinate, Bavaria and Baden-Wuerttemberg','https://www.syna.de/','https://www.syna.de/corp/fuer-unternehmen/netzanschluss','Distribution network','Coverage is indicative; verify responsibility with the operator.','2026-07-18')
on conflict (key) do update set
  operator_name = excluded.operator_name,
  coverage_summary = excluded.coverage_summary,
  connection_url = excluded.connection_url,
  limitation = excluded.limitation,
  verified_on = excluded.verified_on;

create table public.assessment_milestones (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 2 and 200),
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  milestone_type text not null check (milestone_type in ('internal','operator_deadline','submission','meeting','energization')),
  reminder_days integer not null default 7 check (reminder_days between 0 and 365),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessment_collaborators (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  invited_email text not null check (invited_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null default 'viewer' check (role in ('viewer','editor')),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, invited_email)
);

create or replace function public.can_read_assessment(p_site_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.candidate_sites s where s.id = p_site_id and s.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.assessment_collaborators c
    where c.site_id = p_site_id and c.accepted_by = (select auth.uid())
  );
$$;
revoke all on function public.can_read_assessment(uuid) from public;
grant execute on function public.can_read_assessment(uuid) to authenticated;

create or replace function public.accept_assessment_invitations()
returns integer language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  update public.assessment_collaborators
  set accepted_by = (select auth.uid()), accepted_at = now()
  where lower(invited_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
    and accepted_by is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.accept_assessment_invitations() from public;
grant execute on function public.accept_assessment_invitations() to authenticated;

create or replace function public.can_edit_assessment(p_site_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.candidate_sites s where s.id = p_site_id and s.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.assessment_collaborators c
    where c.site_id = p_site_id and c.accepted_by = (select auth.uid()) and c.role = 'editor'
  );
$$;
revoke all on function public.can_edit_assessment(uuid) from public;
grant execute on function public.can_edit_assessment(uuid) to authenticated;

alter table public.assessment_milestones enable row level security;
alter table public.assessment_collaborators enable row level security;

create policy "owners manage milestones" on public.assessment_milestones
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.candidate_sites s where s.id = site_id and s.user_id = (select auth.uid())
));
create policy "collaborators read milestones" on public.assessment_milestones
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborator editors manage milestones" on public.assessment_milestones
for all to authenticated using (public.can_edit_assessment(site_id))
with check (public.can_edit_assessment(site_id));

create policy "owners manage collaborators" on public.assessment_collaborators
for all to authenticated using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.candidate_sites s where s.id = site_id and s.user_id = (select auth.uid())
));
create policy "invitees read invitations" on public.assessment_collaborators
for select to authenticated using (accepted_by = (select auth.uid()));

create policy "collaborators read candidate sites" on public.candidate_sites
for select to authenticated using (public.can_read_assessment(id));
create policy "collaborator editors update candidate sites" on public.candidate_sites
for update to authenticated using (public.can_edit_assessment(id))
with check (public.can_edit_assessment(id));
create policy "collaborators read evidence" on public.assessment_evidence
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborators read scenarios" on public.connection_scenarios
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborators read interval profiles" on public.interval_profiles
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborators read documents" on public.assessment_documents
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborators read requirements" on public.operator_requirements
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborators read correspondence" on public.operator_correspondence
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborators read envelopes" on public.fca_envelopes
for select to authenticated using (public.can_read_assessment(site_id));
create policy "collaborator editors manage evidence" on public.assessment_evidence
for all to authenticated using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "collaborator editors manage scenarios" on public.connection_scenarios
for all to authenticated using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "collaborator editors manage interval profiles" on public.interval_profiles
for all to authenticated using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "collaborator editors manage documents" on public.assessment_documents
for all to authenticated using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "collaborator editors manage requirements" on public.operator_requirements
for all to authenticated using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "collaborator editors manage correspondence" on public.operator_correspondence
for all to authenticated using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "collaborator editors manage envelopes" on public.fca_envelopes
for all to authenticated using (public.can_edit_assessment(site_id)) with check (public.can_edit_assessment(site_id));
create policy "collaborators read assessment files" on storage.objects
for select to authenticated using (
  bucket_id = 'assessment-documents' and exists (
    select 1 from public.assessment_documents d
    where d.storage_path = name and public.can_read_assessment(d.site_id)
  )
);
create policy "collaborator editors upload assessment files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'assessment-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and public.can_edit_assessment(((storage.foldername(name))[2])::uuid)
);
create policy "collaborator editors update assessment files" on storage.objects
for update to authenticated using (
  bucket_id = 'assessment-documents' and exists (
    select 1 from public.assessment_documents d
    where d.storage_path = name and public.can_edit_assessment(d.site_id)
  )
);
create policy "collaborator editors delete assessment files" on storage.objects
for delete to authenticated using (
  bucket_id = 'assessment-documents' and exists (
    select 1 from public.assessment_documents d
    where d.storage_path = name and public.can_edit_assessment(d.site_id)
  )
);

create trigger assessment_milestones_set_updated_at before update on public.assessment_milestones
for each row execute function public.set_updated_at();
create index assessment_milestones_site_due_idx on public.assessment_milestones(site_id, status, due_at);
create index assessment_milestones_user_due_idx on public.assessment_milestones(user_id, status, due_at);
create index assessment_collaborators_site_idx on public.assessment_collaborators(site_id);
create index assessment_collaborators_accepted_idx on public.assessment_collaborators(accepted_by) where accepted_by is not null;
