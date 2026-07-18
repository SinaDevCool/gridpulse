-- Public design-partner intake. Anonymous visitors may submit, but only admins
-- can inspect or manage requests. Validation is duplicated in Postgres so the
-- browser cannot bypass the business rules.
create table public.pilot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'declined', 'converted')),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  work_email text not null check (char_length(work_email) between 5 and 254 and position('@' in work_email) > 1),
  company text not null check (char_length(company) between 2 and 160),
  role_title text check (role_title is null or char_length(role_title) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  project_name text not null check (char_length(project_name) between 2 and 160),
  project_type text not null check (project_type in ('bess', 'data_centre', 'large_load', 'co_location', 'other')),
  project_stage text not null check (project_stage in ('site_screening', 'pre_application', 'application_submitted', 'operator_dialogue', 'other')),
  postcode text not null check (postcode ~ '^[0-9]{5}$'),
  municipality text not null check (char_length(municipality) between 2 and 160),
  federal_state text not null check (char_length(federal_state) between 2 and 80),
  requested_import_mw numeric(12, 3) not null default 0 check (requested_import_mw >= 0 and requested_import_mw <= 100000),
  requested_export_mw numeric(12, 3) not null default 0 check (requested_export_mw >= 0 and requested_export_mw <= 100000),
  battery_power_mw numeric(12, 3) check (battery_power_mw is null or (battery_power_mw >= 0 and battery_power_mw <= 100000)),
  battery_energy_mwh numeric(12, 3) check (battery_energy_mwh is null or (battery_energy_mwh >= 0 and battery_energy_mwh <= 1000000)),
  target_connection_date date,
  connection_challenge text not null check (char_length(connection_challenge) between 20 and 3000),
  consent_to_contact boolean not null check (consent_to_contact),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  source text not null default 'website',
  website text not null default '' check (website = '')
);

create table public.pilot_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.pilot_admins (user_id)
select id from auth.users where lower(email) = 'sina.khedmati@outlook.de'
on conflict (user_id) do nothing;

alter table public.pilot_admins enable row level security;
create policy "admins can read their own membership"
on public.pilot_admins for select
to authenticated
using ((select auth.uid()) = user_id);
grant select on public.pilot_admins to authenticated;

create trigger pilot_requests_set_updated_at
before update on public.pilot_requests
for each row execute function public.set_updated_at();

create index pilot_requests_created_at_idx on public.pilot_requests (created_at desc);
create index pilot_requests_open_status_idx on public.pilot_requests (status, created_at desc)
where status in ('new', 'contacted', 'qualified');

alter table public.pilot_requests enable row level security;

create policy "anyone can submit a valid pilot request"
on public.pilot_requests for insert
to anon, authenticated
with check (consent_to_contact and website = '');

create policy "admins can read pilot requests"
on public.pilot_requests for select
to authenticated
using (exists (select 1 from public.pilot_admins where user_id = (select auth.uid())));

create policy "admins can update pilot requests"
on public.pilot_requests for update
to authenticated
using (exists (select 1 from public.pilot_admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.pilot_admins where user_id = (select auth.uid())));

grant insert on public.pilot_requests to anon, authenticated;
grant select, update on public.pilot_requests to authenticated;
