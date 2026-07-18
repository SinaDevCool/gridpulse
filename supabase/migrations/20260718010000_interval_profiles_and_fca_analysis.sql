-- Pilot workflow: interval profiles and auditable FCA calculation outputs.
create table public.interval_profiles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 2 and 160),
  source_filename text,
  interval_minutes integer not null check (interval_minutes in (15, 30, 60)),
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end >= period_start),
  interval_count integer not null check (interval_count > 0 and interval_count <= 40000),
  peak_import_mw numeric(12,3) not null default 0 check (peak_import_mw >= 0),
  peak_export_mw numeric(12,3) not null default 0 check (peak_export_mw >= 0),
  points jsonb not null check (jsonb_typeof(points) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.connection_scenarios
  add column if not exists energy_value_eur_mwh numeric(12,2) not null default 0 check (energy_value_eur_mwh >= 0),
  add column if not exists analysis jsonb,
  add column if not exists profile_id uuid references public.interval_profiles(id) on delete set null;

create trigger interval_profiles_set_updated_at
before update on public.interval_profiles
for each row execute function public.set_updated_at();

create index interval_profiles_user_id_idx on public.interval_profiles(user_id);
create index interval_profiles_site_id_idx on public.interval_profiles(site_id);
create index connection_scenarios_profile_id_idx on public.connection_scenarios(profile_id);

alter table public.interval_profiles enable row level security;
create policy "owners manage interval profiles" on public.interval_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id and
    exists (
      select 1 from public.candidate_sites site
      where site.id = site_id and site.user_id = (select auth.uid())
    )
  );
