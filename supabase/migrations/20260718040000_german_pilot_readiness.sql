-- GridPulse German pilot: operator routing, maturity evidence, and decision provenance.

alter table public.candidate_sites
  add column if not exists operator_profile_key text,
  add column if not exists operator_confirmation_status text not null default 'screening_only'
    check (operator_confirmation_status in ('screening_only','customer_confirmed','operator_confirmed')),
  add column if not exists target_energization_date date,
  add column if not exists decision_status text not null default 'collect_evidence'
    check (decision_status in ('collect_evidence','prepare_application','submit_application','operator_review','envelope_agreed','hold')),
  add column if not exists decision_notes text;

alter table public.operator_requirements
  add column if not exists profile_key text,
  add column if not exists source_url text;

create table public.operator_profiles (
  key text primary key,
  operator_name text not null,
  grid_level text not null check (grid_level in ('transmission','distribution')),
  region_label text not null,
  application_url text not null,
  procedure_name text not null,
  procedure_version text not null,
  limitation text not null,
  requirement_template jsonb not null check (jsonb_typeof(requirement_template) = 'array'),
  updated_at timestamptz not null default now()
);

create table public.grid_data_sources (
  key text primary key,
  authority text not null,
  title text not null,
  source_url text not null,
  coverage text not null,
  data_type text not null,
  use_in_gridpulse text not null,
  limitation text not null,
  verified_on date not null
);

alter table public.operator_profiles enable row level security;
alter table public.grid_data_sources enable row level security;

create policy "authenticated users read operator profiles" on public.operator_profiles
for select to authenticated using (true);
create policy "authenticated users read grid data sources" on public.grid_data_sources
for select to authenticated using (true);

insert into public.operator_profiles (
  key, operator_name, grid_level, region_label, application_url,
  procedure_name, procedure_version, limitation, requirement_template
)
select profile.key, profile.operator_name, 'transmission', profile.region_label,
  profile.application_url, '4-TSO maturity procedure', 'Version 1.0 / 2026',
  'Transmission-area screening does not identify the responsible DSO or prove capacity. The operator and connection point must be confirmed.',
  jsonb_build_array(
    jsonb_build_object('key','maturity_connection_point','label','Intended connection point and requested capacity','category','project','sort_order',110),
    jsonb_build_object('key','maturity_site_control','label','Evidence of site control or land availability','category','project','sort_order',120),
    jsonb_build_object('key','maturity_permitting','label','Permitting status and authority evidence','category','project','sort_order',130),
    jsonb_build_object('key','maturity_schedule','label','Credible project schedule and energization milestones','category','project','sort_order',140),
    jsonb_build_object('key','maturity_commercial','label','Commercial and financing readiness evidence','category','project','sort_order',150),
    jsonb_build_object('key','maturity_technical','label','Technical application, data sheets, and single-line diagram','category','technical','sort_order',160),
    jsonb_build_object('key','maturity_flexibility','label','Flexible operating concept and controllability','category','flexibility','sort_order',170),
    jsonb_build_object('key','maturity_confidentiality','label','Required confidentiality declarations','category','operator','sort_order',180),
    jsonb_build_object('key','maturity_submission','label','Qualified request submitted in the applicable cycle','category','operator','sort_order',190)
  )
from (values
  ('50hertz','50Hertz Transmission GmbH','Eastern Germany screening area','https://www.50hertz.com/Vertragspartner/Netzkunden/Netzanschluss'),
  ('tennet','TenneT Germany','Central and northern Germany screening area','https://www.tennet.eu/de/strommarkt/netzanschluss'),
  ('amprion','Amprion GmbH','Western Germany screening area','https://www.amprion.net/Market/Grid-Customers/Grid-Connection/Content-Page.html'),
  ('transnetbw','TransnetBW GmbH','South-western Germany screening area','https://www.transnetbw.de/de/transparenz/netzzugang-und-entgelt/ueberblick-netzanschluss')
) as profile(key, operator_name, region_label, application_url)
on conflict (key) do update set
  operator_name = excluded.operator_name,
  region_label = excluded.region_label,
  application_url = excluded.application_url,
  procedure_version = excluded.procedure_version,
  requirement_template = excluded.requirement_template,
  updated_at = now();

insert into public.grid_data_sources (
  key, authority, title, source_url, coverage, data_type, use_in_gridpulse, limitation, verified_on
) values
  ('four_tso_maturity','German 4 TSOs','Maturity procedure for transmission-grid connections','https://www.netztransparenz.de/Portals/1/Dokumente/Reifegradverfahren/Vier%20UENB%20-%20Reifegradverfahren%20-%20Verfahrensdokumentation%20V1.0.pdf','Germany / transmission','Procedure and evidence criteria','Application readiness and decision traceability','Does not publish site-specific available capacity.','2026-07-18'),
  ('nep','German TSOs','Network Development Plan','https://www.netzentwicklungsplan.de/','Germany / transmission','Scenario and planned-grid context','Long-term network context and operator-area screening','Not a connection offer and not evidence of current headroom.','2026-07-18'),
  ('marktstammdatenregister','Bundesnetzagentur','Market Master Data Register','https://www.marktstammdatenregister.de/MaStR','Germany','Registered market assets','Asset and counterparty verification','Registration data does not establish connection availability.','2026-07-18'),
  ('smard','Bundesnetzagentur','SMARD electricity market data','https://www.smard.de/','Germany','Public generation, load, and market time series','System-level context and profile assumptions','National and bidding-zone data cannot prove local grid capacity.','2026-07-18'),
  ('osm','OpenStreetMap contributors','OpenStreetMap power infrastructure','https://www.openstreetmap.org/','Germany','Public geospatial infrastructure','Proximity screening and map context','Completeness and ownership are unverified; proximity is not capacity.','2026-07-18')
on conflict (key) do update set
  title = excluded.title,
  source_url = excluded.source_url,
  limitation = excluded.limitation,
  verified_on = excluded.verified_on;

create or replace function public.apply_operator_profile(p_site_id uuid, p_profile_key text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile public.operator_profiles%rowtype;
begin
  select * into profile from public.operator_profiles where key = p_profile_key;
  if not found then raise exception 'Unknown operator profile'; end if;

  update public.candidate_sites
  set operator_profile_key = profile.key,
      likely_network_operator = profile.operator_name,
      operator_confirmation_status = 'screening_only',
      operator_status = 'screened'
  where id = p_site_id and user_id = (select auth.uid());
  if not found then raise exception 'Assessment not found or not owned by current user'; end if;

  insert into public.operator_requirements (
    site_id, user_id, requirement_key, label, category, sort_order, profile_key, source_url
  )
  select p_site_id, (select auth.uid()), item->>'key', item->>'label', item->>'category',
    (item->>'sort_order')::integer, profile.key, profile.application_url
  from jsonb_array_elements(profile.requirement_template) item
  on conflict (site_id, requirement_key) do update set
    label = excluded.label,
    category = excluded.category,
    sort_order = excluded.sort_order,
    profile_key = excluded.profile_key,
    source_url = excluded.source_url;
end;
$$;

grant execute on function public.apply_operator_profile(uuid, text) to authenticated;

create index if not exists candidate_sites_operator_profile_idx
  on public.candidate_sites(user_id, operator_profile_key);
create index if not exists candidate_sites_decision_status_idx
  on public.candidate_sites(user_id, decision_status);
