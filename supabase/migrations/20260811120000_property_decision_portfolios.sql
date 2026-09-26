-- Property qualification foundation. Additive: candidate_sites remains the assessment root.

alter table public.candidate_sites
  drop constraint if exists candidate_sites_project_type_check;
alter table public.candidate_sites
  add constraint candidate_sites_project_type_check
  check (project_type in ('bess','large_load','co_location','hydrogen','charging_hub'));

alter table public.candidate_sites
  add column if not exists external_property_id text,
  add column if not exists client_organization text,
  add column if not exists confidentiality_classification text not null default 'confidential'
    check (confidentiality_classification in ('public','internal','confidential','strictly_confidential')),
  add column if not exists project_owner text,
  add column if not exists property_type text,
  add column if not exists property_condition text
    check (property_condition is null or property_condition in ('greenfield','brownfield','existing')),
  add column if not exists required_it_load_mw numeric(10,3)
    check (required_it_load_mw is null or required_it_load_mw >= 0),
  add column if not exists required_total_site_load_mw numeric(10,3)
    check (required_total_site_load_mw is null or required_total_site_load_mw >= 0),
  add column if not exists target_energisation_year integer
    check (target_energisation_year is null or target_energisation_year between 2020 and 2200),
  add column if not exists development_phase text,
  add column if not exists notes text,
  add column if not exists study_status text not null default 'not_started'
    check (study_status in ('not_started','screening','study_requested','calculated','reviewed','failed','stale')),
  add column if not exists evidence_maturity text not null default 'declared'
    check (evidence_maturity in ('declared','mapped','calculated','reviewed','operator_confirmed')),
  add column if not exists source_system text,
  add column if not exists source_record_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists candidate_sites_user_external_property_unique
  on public.candidate_sites(user_id, external_property_id)
  where external_property_id is not null;
create index if not exists candidate_sites_property_qualification_idx
  on public.candidate_sites(user_id, assessment_status, study_status, updated_at desc);

create table if not exists public.property_boundaries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  boundary extensions.geometry(Geometry, 4326) not null,
  parcel_reference text,
  source_system text,
  source_record_id text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (extensions.st_geometrytype(boundary) in ('ST_Polygon','ST_MultiPolygon'))
);
create index if not exists property_boundaries_site_idx on public.property_boundaries(site_id);
create index if not exists property_boundaries_geometry_idx on public.property_boundaries using gist(boundary);
alter table public.property_boundaries enable row level security;
grant select, insert, update, delete on public.property_boundaries to authenticated;
create policy "participants read property boundaries" on public.property_boundaries
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors manage property boundaries" on public.property_boundaries
  for all to authenticated using (public.can_edit_assessment(site_id))
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));

create table if not exists public.finder_project_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null,
  project_snapshot jsonb not null,
  selected_candidate_ids text[] not null default '{}',
  comparison_snapshot jsonb not null default '[]'::jsonb,
  source text not null default 'power_finder',
  created_at timestamptz not null default now(),
  unique(site_id, version)
);
create index if not exists finder_project_versions_site_idx
  on public.finder_project_versions(site_id, version desc);
alter table public.finder_project_versions enable row level security;
grant select, insert on public.finder_project_versions to authenticated;
create policy "participants read finder project versions" on public.finder_project_versions
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors create finder project versions" on public.finder_project_versions
  for insert to authenticated
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));

create table if not exists public.capacity_dossiers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  candidate_id uuid references public.project_connection_candidates(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null,
  status text not null default 'draft'
    check (status in ('draft','calculated','under_review','validated','stale','failed','superseded')),
  evidence_class text not null default 'customer_declared'
    check (evidence_class in ('customer_declared','public_source','synthetic_model','governed_calculation','operator_reviewed','operator_confirmed')),
  model_version text,
  study_version text,
  capacity_basis_version text,
  requested_import_mw numeric(10,3) check (requested_import_mw is null or requested_import_mw >= 0),
  requested_export_mw numeric(10,3) check (requested_export_mw is null or requested_export_mw >= 0),
  n0_capacity_mw numeric(10,3) check (n0_capacity_mw is null or n0_capacity_mw >= 0),
  n1_firm_capacity_mw numeric(10,3) check (n1_firm_capacity_mw is null or n1_firm_capacity_mw >= 0),
  flexible_capacity_mw numeric(10,3) check (flexible_capacity_mw is null or flexible_capacity_mw >= 0),
  bess_assisted_capacity_mw numeric(10,3) check (bess_assisted_capacity_mw is null or bess_assisted_capacity_mw >= 0),
  restricted_hours integer check (restricted_hours is null or restricted_hours >= 0),
  binding_contingency text,
  binding_equipment text,
  thermal_constraint text,
  voltage_constraint text,
  search_bound_state text check (search_bound_state is null or search_bound_state in ('exact','lower_bound','search_ceiling')),
  source_register jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  unresolved_evidence jsonb not null default '[]'::jsonb,
  operator_questions jsonb not null default '[]'::jsonb,
  claims_and_limitations jsonb not null default '[]'::jsonb,
  validation_status text not null default 'unverified'
    check (validation_status in ('unverified','validated','rejected','expired')),
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  unique(site_id, version),
  check (valid_to is null or valid_from is null or valid_to > valid_from),
  check (status not in ('stale','failed') or validation_status <> 'validated')
);
create index if not exists capacity_dossiers_site_idx
  on public.capacity_dossiers(site_id, version desc);
alter table public.capacity_dossiers enable row level security;
grant select, insert, update on public.capacity_dossiers to authenticated;
create policy "participants read capacity dossiers" on public.capacity_dossiers
  for select to authenticated using (public.can_read_assessment(site_id));
create policy "editors create capacity dossiers" on public.capacity_dossiers
  for insert to authenticated
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));
create policy "editors update draft capacity dossiers" on public.capacity_dossiers
  for update to authenticated using (public.can_edit_assessment(site_id) and status = 'draft')
  with check (public.can_edit_assessment(site_id) and status = 'draft');

create table if not exists public.property_integration_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  event_type text not null check (event_type in ('property_updated','study_completed','dossier_published')),
  source_system text,
  idempotency_key text not null,
  payload jsonb not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','delivered','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique(user_id, idempotency_key)
);
alter table public.property_integration_events enable row level security;
grant select on public.property_integration_events to authenticated;
create policy "participants read property integration events" on public.property_integration_events
  for select to authenticated using (public.can_read_assessment(site_id));

create or replace function public.save_finder_property(p_project jsonb, p_candidates jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  property_id uuid;
  property_type text := coalesce(nullif(p_project->>'type',''),'large_load');
  row_candidate jsonb;
begin
  if owner_id is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(p_project) <> 'object' then raise exception 'Project must be an object.'; end if;
  if (p_project->>'latitude')::numeric not between 47 and 56
    or (p_project->>'longitude')::numeric not between 5 and 16 then
    raise exception 'Coordinates must be within Germany.';
  end if;
  if property_type in ('data_centre','industrial_load','electrolyser') then property_type := 'large_load'; end if;
  if property_type = 'battery_storage' then property_type := 'bess'; end if;

  insert into public.candidate_sites (
    user_id,name,project_type,latitude,longitude,requested_import_mw,requested_export_mw,
    minimum_viable_import_mw,target_energisation_year,target_energization_date,
    external_property_id,client_organization,confidentiality_classification,project_owner,
    property_type,property_condition,required_it_load_mw,required_total_site_load_mw,
    development_phase,land_status,notes,study_status,evidence_maturity,intake_source,
    source_system,source_record_metadata
  ) values (
    owner_id,coalesce(nullif(p_project->>'name',''),'Untitled property'),property_type,
    (p_project->>'latitude')::numeric,(p_project->>'longitude')::numeric,
    coalesce((p_project->>'importMw')::numeric,0),coalesce((p_project->>'exportMw')::numeric,0),
    nullif(p_project->>'minimumFirmMw','')::numeric,nullif(p_project->>'targetEnergisationYear','')::integer,
    case when p_project ? 'targetEnergisationYear' then make_date((p_project->>'targetEnergisationYear')::integer,1,1) else null end,
    nullif(p_project->>'externalPropertyId',''),nullif(p_project->>'clientOrganization',''),
    coalesce(nullif(p_project->>'confidentialityClassification',''),'confidential'),
    nullif(p_project->>'projectOwner',''),nullif(p_project->>'propertyType',''),
    nullif(p_project->>'propertyCondition',''),nullif(p_project->>'requiredItLoadMw','')::numeric,
    coalesce(nullif(p_project->>'requiredTotalSiteLoadMw','')::numeric,(p_project->>'importMw')::numeric),
    nullif(p_project->>'developmentPhase',''),coalesce(nullif(p_project->>'landControlStatus',''),'unknown'),
    nullif(p_project->>'notes',''),'screening','mapped','power_finder',
    coalesce(nullif(p_project->>'sourceSystem',''),'gridpulse_power_finder'),p_project
  ) returning id into property_id;

  if p_project->'boundary' is not null and jsonb_typeof(p_project->'boundary') = 'object' then
    insert into public.property_boundaries (site_id,user_id,boundary,source_geometry)
    values (
      property_id,
      owner_id,
      extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson((p_project->'boundary')::text),4326)),
      p_project->'boundary'
    );
  end if;

  insert into public.finder_project_versions(site_id,user_id,version,project_snapshot,selected_candidate_ids,comparison_snapshot)
  values (
    property_id,owner_id,1,p_project,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_project->'selectedCandidateIds','[]'::jsonb))),'{}'),
    coalesce(p_candidates,'[]'::jsonb)
  );

  for row_candidate in select * from jsonb_array_elements(coalesce(p_candidates,'[]'::jsonb)) loop
    insert into public.project_connection_candidates (
      site_id,user_id,source_feature_id,feature_kind,candidate_name,longitude,latitude,
      operator_name,voltage_kv,distance_km,evidence_class,capacity_state,context_score,source_snapshot
    ) values (
      property_id,owner_id,row_candidate->>'id','node',coalesce(row_candidate->>'nodeName','Mapped candidate'),
      nullif(row_candidate->>'longitude','')::double precision,nullif(row_candidate->>'latitude','')::double precision,
      nullif(row_candidate->>'operator',''),nullif(row_candidate->>'voltageKv','')::numeric,
      nullif(row_candidate->>'distanceKm','')::numeric,coalesce(nullif(row_candidate->>'evidenceClass',''),'open_mapping'),
      coalesce(nullif(row_candidate->>'capacityState',''),'not_established'),
      nullif(row_candidate->>'screeningRank','')::integer,row_candidate
    ) on conflict (site_id,source_feature_id) do nothing;
  end loop;

  insert into public.property_integration_events(site_id,user_id,event_type,source_system,idempotency_key,payload)
  values (property_id,owner_id,'property_updated','gridpulse_power_finder','property-created:'||property_id::text,p_project);
  return property_id;
end;
$$;
revoke all on function public.save_finder_property(jsonb,jsonb) from public, anon;
grant execute on function public.save_finder_property(jsonb,jsonb) to authenticated;

create or replace function public.import_property_batch(p_properties jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  result uuid[] := '{}';
  created_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(p_properties) <> 'array' or jsonb_array_length(p_properties) not between 1 and 100 then
    raise exception 'Import 1 to 100 properties.';
  end if;
  for item in select * from jsonb_array_elements(p_properties) loop
    created_id := public.save_finder_property(item, coalesce(item->'comparisonSnapshot','[]'::jsonb));
    result := array_append(result, created_id);
  end loop;
  return result;
end;
$$;
revoke all on function public.import_property_batch(jsonb) from public, anon;
grant execute on function public.import_property_batch(jsonb) to authenticated;

comment on table public.capacity_dossiers is
  'Governed property-node capacity dossiers. Null capacity is unknown and must never be rendered as zero.';
comment on table public.property_integration_events is
  'Transactional outbox boundary for property updates, study completion and dossier publication.';

create or replace function public.property_capacity_dossier(p_site_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  site public.candidate_sites%rowtype;
  dossier public.capacity_dossiers%rowtype;
  result jsonb;
begin
  if not public.can_read_assessment(p_site_id) then raise exception 'Assessment access required.'; end if;
  select * into site from public.candidate_sites where id = p_site_id;
  if not found then raise exception 'Property not found.'; end if;
  select * into dossier from public.capacity_dossiers where site_id = p_site_id order by version desc limit 1;
  result := jsonb_build_object(
    'property', jsonb_build_object('id',site.id,'name',site.name,'external_property_id',site.external_property_id,'latitude',site.latitude,'longitude',site.longitude,'property_type',coalesce(site.property_type,site.project_type),'confidentiality_classification',site.confidentiality_classification),
    'requirements', jsonb_build_object('requested_import_mw',site.requested_import_mw,'requested_export_mw',site.requested_export_mw,'required_it_load_mw',site.required_it_load_mw,'required_total_site_load_mw',site.required_total_site_load_mw,'target_energisation_year',site.target_energisation_year),
    'property_readiness', jsonb_build_object('land_control_status',site.land_status,'planning_status',site.planning_status,'development_phase',site.development_phase),
    'dossier', case when dossier.id is null then jsonb_build_object('status','not_calculated','validation_status','unverified') else to_jsonb(dossier) end,
    'alternatives', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.candidate_name,'distance_km',c.distance_km,'voltage_kv',c.voltage_kv,'operator',c.operator_name,'status',c.status,'capacity_state',c.capacity_state,'context_score',c.context_score) order by c.context_score desc nulls last) from public.project_connection_candidates c where c.site_id=p_site_id),'[]'::jsonb)
  );
  if dossier.status in ('stale','failed') or dossier.validation_status in ('rejected','expired') then
    result := jsonb_set(result,'{dossier}',(result->'dossier') || jsonb_build_object('n0_capacity_mw',null,'n1_firm_capacity_mw',null,'flexible_capacity_mw',null,'bess_assisted_capacity_mw',null,'restricted_hours',null,'fail_closed',true));
  end if;
  return result;
end;
$$;
revoke all on function public.property_capacity_dossier(uuid) from public, anon;
grant execute on function public.property_capacity_dossier(uuid) to authenticated;
