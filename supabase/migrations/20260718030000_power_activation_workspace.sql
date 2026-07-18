-- GridPulse Phase 1: operator-ready power activation workspace.

create table public.assessment_documents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  file_name text not null check (char_length(file_name) between 1 and 240),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  document_type text not null check (document_type in (
    'project_brief','site_plan','single_line_diagram','technical_specification',
    'load_profile','operator_correspondence','connection_offer','fca_schedule','other'
  )),
  source_classification text not null check (source_classification in (
    'official_source','customer_input','operator_source','third_party'
  )),
  review_status text not null default 'uploaded' check (review_status in (
    'uploaded','reviewed','accepted','superseded'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operator_requirements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  requirement_key text not null,
  label text not null,
  category text not null check (category in ('project','technical','flexibility','operator')),
  status text not null default 'missing' check (status in ('missing','in_progress','ready','submitted','accepted','not_applicable')),
  document_id uuid references public.assessment_documents(id) on delete set null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, requirement_key)
);

create table public.operator_correspondence (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  direction text not null check (direction in ('outbound','inbound','meeting','internal_note')),
  contact_name text,
  subject text not null check (char_length(subject) between 2 and 240),
  occurred_at timestamptz not null,
  summary text not null check (char_length(summary) between 2 and 4000),
  document_id uuid references public.assessment_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fca_envelopes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null default 0,
  name text not null check (char_length(name) between 2 and 160),
  mode text not null check (mode in ('static','scheduled','dynamic')),
  max_import_mw numeric(10,3) check (max_import_mw >= 0),
  max_export_mw numeric(10,3) check (max_export_mw >= 0),
  valid_from timestamptz,
  valid_to timestamptz check (valid_to is null or valid_from is null or valid_to >= valid_from),
  restriction_schedule jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','operator_proposed','agreed','superseded','expired')),
  source_document_id uuid references public.assessment_documents(id) on delete set null,
  supersedes_id uuid references public.fca_envelopes(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (site_id, version)
);

create or replace function public.assign_fca_envelope_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.site_id::text, 0));
  if new.version is null or new.version < 1 then
    select coalesce(max(version), 0) + 1 into new.version
    from public.fca_envelopes where site_id = new.site_id;
  end if;
  return new;
end;
$$;

create trigger fca_envelopes_assign_version
before insert on public.fca_envelopes
for each row execute function public.assign_fca_envelope_version();

create trigger assessment_documents_set_updated_at before update on public.assessment_documents
for each row execute function public.set_updated_at();
create trigger operator_requirements_set_updated_at before update on public.operator_requirements
for each row execute function public.set_updated_at();
create trigger operator_correspondence_set_updated_at before update on public.operator_correspondence
for each row execute function public.set_updated_at();

create index assessment_documents_site_created_idx on public.assessment_documents(site_id, created_at desc);
create index assessment_documents_user_id_idx on public.assessment_documents(user_id);
create index operator_requirements_site_sort_idx on public.operator_requirements(site_id, sort_order);
create index operator_requirements_user_id_idx on public.operator_requirements(user_id);
create index operator_correspondence_site_occurred_idx on public.operator_correspondence(site_id, occurred_at desc);
create index operator_correspondence_user_id_idx on public.operator_correspondence(user_id);
create index fca_envelopes_site_version_idx on public.fca_envelopes(site_id, version desc);
create index fca_envelopes_user_id_idx on public.fca_envelopes(user_id);

alter table public.assessment_documents enable row level security;
alter table public.operator_requirements enable row level security;
alter table public.operator_correspondence enable row level security;
alter table public.fca_envelopes enable row level security;

create policy "owners manage assessment documents" on public.assessment_documents
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.candidate_sites site where site.id = site_id and site.user_id = (select auth.uid())
));
create policy "owners manage operator requirements" on public.operator_requirements
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.candidate_sites site where site.id = site_id and site.user_id = (select auth.uid())
));
create policy "owners manage operator correspondence" on public.operator_correspondence
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.candidate_sites site where site.id = site_id and site.user_id = (select auth.uid())
));
create policy "owners manage fca envelopes" on public.fca_envelopes
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.candidate_sites site where site.id = site_id and site.user_id = (select auth.uid())
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-documents', 'assessment-documents', false, 26214400,
  array['application/pdf','text/csv','application/vnd.ms-excel','image/png','image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "owners upload assessment files" on storage.objects for insert to authenticated
with check (bucket_id = 'assessment-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners read assessment files" on storage.objects for select to authenticated
using (bucket_id = 'assessment-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners update assessment files" on storage.objects for update to authenticated
using (bucket_id = 'assessment-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owners delete assessment files" on storage.objects for delete to authenticated
using (bucket_id = 'assessment-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.seed_operator_requirements()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.operator_requirements (site_id, user_id, requirement_key, label, category, sort_order)
  values
    (new.id, new.user_id, 'project_brief', 'Qualified project and capacity brief', 'project', 10),
    (new.id, new.user_id, 'site_plan', 'Site plan and proposed connection location', 'project', 20),
    (new.id, new.user_id, 'single_line_diagram', 'Single-line electrical diagram', 'technical', 30),
    (new.id, new.user_id, 'load_profile', 'Interval operating or load profile', 'technical', 40),
    (new.id, new.user_id, 'flexibility_declaration', 'Declared flexibility and fallback resources', 'flexibility', 50),
    (new.id, new.user_id, 'protection_concept', 'Protection and control concept', 'technical', 60),
    (new.id, new.user_id, 'connection_request', 'Complete operator connection request', 'operator', 70),
    (new.id, new.user_id, 'operator_response', 'Network-operator response or proposal', 'operator', 80)
  on conflict (site_id, requirement_key) do nothing;
  return new;
end;
$$;

create trigger candidate_sites_seed_operator_requirements
after insert on public.candidate_sites
for each row execute function public.seed_operator_requirements();

insert into public.operator_requirements (site_id, user_id, requirement_key, label, category, sort_order)
select site.id, site.user_id, requirement.key, requirement.label, requirement.category, requirement.sort_order
from public.candidate_sites site
cross join (values
  ('project_brief', 'Qualified project and capacity brief', 'project', 10),
  ('site_plan', 'Site plan and proposed connection location', 'project', 20),
  ('single_line_diagram', 'Single-line electrical diagram', 'technical', 30),
  ('load_profile', 'Interval operating or load profile', 'technical', 40),
  ('flexibility_declaration', 'Declared flexibility and fallback resources', 'flexibility', 50),
  ('protection_concept', 'Protection and control concept', 'technical', 60),
  ('connection_request', 'Complete operator connection request', 'operator', 70),
  ('operator_response', 'Network-operator response or proposal', 'operator', 80)
) as requirement(key, label, category, sort_order)
on conflict (site_id, requirement_key) do nothing;
