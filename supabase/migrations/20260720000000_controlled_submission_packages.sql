-- Versioned, immutable operator-engagement submission manifests.

create table public.submission_packages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('draft','internal_review','approved_for_operator','superseded')),
  language text not null default 'de_en' check (language in ('de','en','de_en')),
  title text not null,
  recipient_organization text,
  purpose text not null,
  manifest jsonb not null,
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  document_count integer not null default 0 check (document_count >= 0),
  open_gate_count integer not null default 0 check (open_gate_count >= 0),
  operator_confirmed_count integer not null default 0 check (operator_confirmed_count >= 0),
  release_note text not null,
  created_at timestamptz not null default now(),
  unique(site_id, version),
  unique(site_id, manifest_hash)
);

create or replace function public.assign_submission_package_version()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.version is null or new.version < 1 then
    select coalesce(max(version), 0) + 1 into new.version from public.submission_packages where site_id = new.site_id;
  end if;
  return new;
end;
$$;

create trigger submission_packages_assign_version before insert on public.submission_packages
  for each row execute function public.assign_submission_package_version();

alter table public.submission_packages enable row level security;
create policy "participants read submission packages" on public.submission_packages
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors create submission packages" on public.submission_packages
  for insert to authenticated with check (public.can_edit_assessment(site_id) and user_id = auth.uid());

revoke all on table public.submission_packages from anon;
grant select, insert on table public.submission_packages to authenticated;

create index submission_packages_site_version_idx on public.submission_packages(site_id, version desc);
create trigger submission_packages_activity after insert on public.submission_packages
  for each row execute function public.log_assessment_change();

comment on table public.submission_packages is 'Immutable operator-engagement package manifests. Approved status means customer release approval, not operator validation.';
