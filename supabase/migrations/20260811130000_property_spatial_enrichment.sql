-- Anonymous, provenance-first property enrichment over accepted public releases.
-- No customer coordinate or result is persisted by this API.

alter table public.grid_sources
  add column if not exists dataset_domain text not null default 'grid'
  check (dataset_domain in ('grid','administrative','built_environment','environment','natural_hazard'));

create table if not exists public.administrative_areas (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.grid_dataset_releases(id) on delete cascade,
  source_record_id text not null,
  level text not null check (level in ('municipality','district','federal_state')),
  official_name text not null,
  official_key text,
  federal_state_name text,
  federal_state_code text,
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(dataset_release_id, level, source_record_id)
);

create table if not exists public.osm_context_features (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.grid_dataset_releases(id) on delete cascade,
  source_record_id text not null,
  feature_class text not null check (feature_class in ('address','building','landuse','road','rail','water','industrial')),
  name text,
  geometry extensions.geometry(Geometry, 4326) not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(dataset_release_id, feature_class, source_record_id)
);

create table if not exists public.protected_areas (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.grid_dataset_releases(id) on delete cascade,
  source_record_id text not null,
  category text not null,
  official_name text,
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(dataset_release_id, source_record_id)
);

create table if not exists public.heavy_rain_areas (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.grid_dataset_releases(id) on delete cascade,
  source_record_id text not null,
  scenario text not null,
  depth_m numeric,
  velocity_ms numeric,
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(dataset_release_id, source_record_id)
);

create table if not exists public.enrichment_coverage (
  source_id text not null references public.grid_sources(id) on delete cascade,
  region_code text not null,
  status text not null check (status in ('available','not_covered','unavailable')),
  geometry extensions.geometry(MultiPolygon, 4326),
  observed_at timestamptz,
  notes text,
  primary key(source_id, region_code)
);

create index if not exists administrative_areas_geometry_idx on public.administrative_areas using gist(geometry);
create index if not exists osm_context_features_geometry_idx on public.osm_context_features using gist(geometry);
create index if not exists protected_areas_geometry_idx on public.protected_areas using gist(geometry);
create index if not exists heavy_rain_areas_geometry_idx on public.heavy_rain_areas using gist(geometry);
create index if not exists enrichment_coverage_geometry_idx on public.enrichment_coverage using gist(geometry);

alter table public.administrative_areas enable row level security;
alter table public.osm_context_features enable row level security;
alter table public.protected_areas enable row level security;
alter table public.heavy_rain_areas enable row level security;
alter table public.enrichment_coverage enable row level security;

revoke all on public.administrative_areas, public.osm_context_features,
  public.protected_areas, public.heavy_rain_areas, public.enrichment_coverage
  from public, anon, authenticated;

create or replace function public.property_enrichment_batch(
  p_properties jsonb,
  p_sources text[] default array['bkg_admin','osm_context','bfn_protected','mastr','bkg_heavy_rain','power_finder']::text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  result jsonb;
begin
  if jsonb_typeof(p_properties) <> 'array' or jsonb_array_length(p_properties) not between 1 and 100 then
    raise exception 'provide 1-100 properties';
  end if;
  if p_sources <@ array['bkg_admin','osm_context','bfn_protected','mastr','bkg_heavy_rain','power_finder']::text[] is not true then
    raise exception 'unsupported source';
  end if;

  with requested as (
    select
      value->>'property_id' property_id,
      (value->>'latitude')::double precision latitude,
      (value->>'longitude')::double precision longitude,
      extensions.st_setsrid(extensions.st_makepoint((value->>'longitude')::double precision, (value->>'latitude')::double precision), 4326) point,
      case when value->'boundary' is null or value->'boundary' = 'null'::jsonb
        then null else extensions.st_setsrid(extensions.st_geomfromgeojson((value->'boundary')::text),4326) end boundary
    from jsonb_array_elements(p_properties) value
    where (value->>'latitude')::double precision between 47.2 and 55.2
      and (value->>'longitude')::double precision between 5.8 and 15.1
  ), active as (
    select r.*, s.publisher, s.source_url, s.licence
    from public.grid_dataset_releases r join public.grid_sources s on s.id=r.source_id
    where r.status='active'
  ), findings as (
    select q.property_id, jsonb_build_object(
      'id', gen_random_uuid(), 'propertyId', q.property_id, 'source','bkg_admin', 'category','municipality',
      'fieldPath','municipality', 'title','Official municipality', 'displayValue',a.official_name,
      'proposedValue',a.official_name, 'status','proposed', 'confidence','high', 'method','point_in_polygon',
      'sourceOrganisation',r.publisher, 'sourceReference',a.source_record_id, 'sourceUrl',r.source_url,
      'licence',r.licence, 'releaseId',r.id, 'observedAt',r.activated_at, 'retrievedAt',now(),
      'coverage','available', 'limitations',jsonb_build_array('Administrative context; not a cadastral or ownership record.'), 'reviewedAt',null
    ) finding from requested q join public.administrative_areas a on a.level='municipality' and extensions.st_covers(a.geometry,q.point)
      join active r on r.id=a.dataset_release_id where 'bkg_admin'=any(p_sources)
    union all
    select q.property_id, jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',q.property_id,'source','bkg_admin','category','municipality',
      'fieldPath','dataCentreProfile.federalState','title','Official federal state','displayValue',a.federal_state_name,
      'proposedValue',a.federal_state_name,'status','proposed','confidence','high','method','point_in_polygon',
      'sourceOrganisation',r.publisher,'sourceReference',a.source_record_id,'sourceUrl',r.source_url,'licence',r.licence,
      'releaseId',r.id,'observedAt',r.activated_at,'retrievedAt',now(),'coverage','available',
      'limitations',jsonb_build_array('Administrative context; review boundary-edge locations.'),'reviewedAt',null
    ) from requested q join public.administrative_areas a on a.level='municipality' and extensions.st_covers(a.geometry,q.point)
      join active r on r.id=a.dataset_release_id where 'bkg_admin'=any(p_sources) and a.federal_state_name is not null
    union all
    select q.property_id, jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',q.property_id,'source','osm_context','category','land','fieldPath',null,
      'title','Mapped industrial land context','displayValue',coalesce(round(100*extensions.st_area(extensions.st_intersection(coalesce(q.boundary,q.point),f.geometry)::geography)/nullif(extensions.st_area(coalesce(q.boundary,q.point)::geography),0),1)::text||'% intersection','Mapped at site'),
      'proposedValue',true,'status','proposed','confidence','medium','method','intersection','sourceOrganisation',r.publisher,
      'sourceReference',f.source_record_id,'sourceUrl',r.source_url,'licence',r.licence,'releaseId',r.id,
      'observedAt',r.activated_at,'retrievedAt',now(),'coverage','available','limitations',jsonb_build_array('Open mapping does not establish zoning, title or developability.'),'reviewedAt',null
    ) from requested q join public.osm_context_features f on f.feature_class in ('industrial','landuse') and extensions.st_intersects(f.geometry,coalesce(q.boundary,q.point))
      join active r on r.id=f.dataset_release_id where 'osm_context'=any(p_sources)
    union all
    select q.property_id, jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',q.property_id,'source','bfn_protected','category','environment','fieldPath',null,
      'title','Protected-area intersection','displayValue',coalesce(p.official_name,p.category),'proposedValue',true,
      'status','proposed','confidence','high','method','intersection','sourceOrganisation',r.publisher,'sourceReference',p.source_record_id,
      'sourceUrl',r.source_url,'licence',r.licence,'releaseId',r.id,'observedAt',r.activated_at,'retrievedAt',now(),
      'coverage','available','limitations',jsonb_build_array('Screening flag only; legal and planning review is required.'),'reviewedAt',null
    ) from requested q join public.protected_areas p on extensions.st_intersects(p.geometry,coalesce(q.boundary,q.point))
      join active r on r.id=p.dataset_release_id where 'bfn_protected'=any(p_sources)
    union all
    select q.property_id, jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',q.property_id,'source','mastr','category','grid','fieldPath',null,
      'title','Nearby registered energy assets','displayValue',count(a.id)::text||' within 10 km','proposedValue',count(a.id),
      'status','proposed','confidence','high','method','radius_aggregate','sourceOrganisation',r.publisher,
      'sourceReference','10km-radius-aggregate','sourceUrl',r.source_url,'licence',r.licence,'releaseId',r.id,
      'observedAt',r.activated_at,'retrievedAt',now(),'coverage','available',
      'limitations',jsonb_build_array('Registered assets are context only and do not establish grid headroom.'),'reviewedAt',null
    ) from requested q join public.canonical_energy_assets a on a.geometry is not null and extensions.st_dwithin(a.geometry::geography,q.point::geography,10000)
      join active r on r.id=a.dataset_release_id where 'mastr'=any(p_sources) group by q.property_id,r.publisher,r.source_url,r.licence,r.id,r.activated_at
    union all
    select q.property_id, jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',q.property_id,'source','bkg_heavy_rain','category','environment','fieldPath',null,
      'title','Heavy-rain screening intersection','displayValue',coalesce('Max modeled depth '||max(h.depth_m)::text||' m','Modeled intersection'),
      'proposedValue',max(h.depth_m),'status','proposed','confidence','high','method','intersection','sourceOrganisation',r.publisher,
      'sourceReference',string_agg(h.source_record_id,','),'sourceUrl',r.source_url,'licence',r.licence,'releaseId',r.id,
      'observedAt',r.activated_at,'retrievedAt',now(),'coverage','available',
      'limitations',jsonb_build_array('Hazard indication, not a site-specific flood assessment.'),'reviewedAt',null
    ) from requested q join public.heavy_rain_areas h on extensions.st_intersects(h.geometry,coalesce(q.boundary,q.point))
      join active r on r.id=h.dataset_release_id where 'bkg_heavy_rain'=any(p_sources) group by q.property_id,r.publisher,r.source_url,r.licence,r.id,r.activated_at
    union all
    select q.property_id, jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',q.property_id,'source','power_finder','category','grid','fieldPath',null,
      'title','Nearest mapped grid candidate','displayValue',n.canonical_name||' · '||round((extensions.st_distance(n.geometry::geography,q.point::geography)/1000)::numeric,1)::text||' km',
      'proposedValue',n.canonical_name,'status','proposed','confidence','medium','method','nearest','sourceOrganisation',s.publisher,
      'sourceReference',n.source_record_id,'sourceUrl',s.source_url,'licence',s.licence,'releaseId',coalesce(r.id::text,'canonical-active'),
      'observedAt',r.activated_at,'retrievedAt',now(),'coverage','available',
      'limitations',jsonb_build_array('Mapped proximity is not available capacity or a connection offer.'),'reviewedAt',null
    ) from requested q cross join lateral (select * from public.canonical_grid_nodes n order by n.geometry <-> q.point limit 1) n
      join public.grid_sources s on s.id=n.source_id left join active r on r.source_id=n.source_id where 'power_finder'=any(p_sources)
  ), source_status as (
    select source, case when exists(select 1 from findings f where f.finding->>'source'=source) then 'complete' else 'unavailable' end status
    from unnest(array['bkg_admin','osm_context','bfn_protected','mastr','bkg_heavy_rain','power_finder']::text[]) source
  )
  select jsonb_build_object(
    'releaseFingerprint',encode(extensions.digest(coalesce(string_agg(distinct id::text,',' order by id::text),'none'),'sha256'),'hex'),
    'findings',coalesce((select jsonb_agg(finding) from findings),'[]'::jsonb),
    'sourceStatus',(select jsonb_object_agg(source,status) from source_status)
  ) into result from active;
  return result;
end;
$$;

revoke all on function public.property_enrichment_batch(jsonb,text[]) from public, authenticated;
grant execute on function public.property_enrichment_batch(jsonb,text[]) to anon;

comment on function public.property_enrichment_batch is
  'Bounded anonymous spatial enrichment. Returns reviewable public-source findings and persists no customer property data.';
