-- GridPulse 2.0: evidence-led grid connection assessments.
create table public.candidate_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 2 and 160),
  project_type text not null check (project_type in ('bess','large_load','co_location')),
  country_code text not null default 'DE' check (country_code = 'DE'),
  latitude numeric(9,6) not null check (latitude between 47 and 56),
  longitude numeric(9,6) not null check (longitude between 5 and 16),
  requested_import_mw numeric(10,3) not null default 0 check (requested_import_mw >= 0),
  requested_export_mw numeric(10,3) not null default 0 check (requested_export_mw >= 0),
  bess_power_mw numeric(10,3) check (bess_power_mw >= 0),
  bess_energy_mwh numeric(10,3) check (bess_energy_mwh >= 0),
  target_voltage_kv numeric(10,3) check (target_voltage_kv > 0),
  likely_network_operator text,
  operator_status text not null default 'screening' check (operator_status in ('screening','customer_confirmed','operator_confirmed')),
  assessment_status text not null default 'draft' check (assessment_status in ('draft','evidence_collection','operator_review','report_ready','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.assessment_evidence (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  classification text not null check (classification in ('official_source','customer_input','assumption','calculation','operator_validation_required')),
  title text not null, value jsonb, unit text, source_name text, source_url text,
  observed_at timestamptz, confidence text check (confidence in ('high','medium','low','unknown')),
  validation_status text not null default 'unverified' check (validation_status in ('unverified','collected','validated','rejected','missing')),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.connection_scenarios (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null, connection_mode text not null check (connection_mode in ('unrestricted','static_fca','dynamic_fca')),
  max_import_mw numeric(10,3) check (max_import_mw >= 0), max_export_mw numeric(10,3) check (max_export_mw >= 0),
  restriction_schedule jsonb, assumptions jsonb not null default '[]'::jsonb,
  calculation_version text not null default 'screening-v1', status text not null default 'draft' check (status in ('draft','evidence_incomplete','calculated','operator_validated')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger candidate_sites_set_updated_at
before update on public.candidate_sites
for each row execute function public.set_updated_at();

create trigger assessment_evidence_set_updated_at
before update on public.assessment_evidence
for each row execute function public.set_updated_at();

create trigger connection_scenarios_set_updated_at
before update on public.connection_scenarios
for each row execute function public.set_updated_at();

create index candidate_sites_user_id_idx on public.candidate_sites(user_id);
create index assessment_evidence_site_id_idx on public.assessment_evidence(site_id);
create index assessment_evidence_user_id_idx on public.assessment_evidence(user_id);
create index connection_scenarios_site_id_idx on public.connection_scenarios(site_id);
create index connection_scenarios_user_id_idx on public.connection_scenarios(user_id);

alter table public.candidate_sites enable row level security;
alter table public.assessment_evidence enable row level security;
alter table public.connection_scenarios enable row level security;
create policy "owners manage candidate sites" on public.candidate_sites for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owners manage assessment evidence" on public.assessment_evidence for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.candidate_sites s where s.id = site_id and s.user_id = (select auth.uid())));
create policy "owners manage connection scenarios" on public.connection_scenarios for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.candidate_sites s where s.id = site_id and s.user_id = (select auth.uid())));
