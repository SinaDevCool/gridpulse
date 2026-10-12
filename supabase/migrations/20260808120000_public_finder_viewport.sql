-- Account-free, read-only Finder viewport. This function deliberately exposes
-- only accepted public-source screening fields; it grants no table access.

create or replace function public.power_finder_public_viewport(
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  include_generation boolean default true,
  include_storage boolean default true,
  max_features integer default 2500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if west is null or south is null or east is null or north is null
     or west >= east or south >= north
     or west < 10.5 or east > 15.2 or south < 50.8 or north > 54.0
     or east - west > 4.7 or north - south > 3.2 then
    raise exception 'Invalid or unsupported Brandenburg viewport'
      using errcode = '22023';
  end if;

  with bounds as (
    select extensions.st_makeenvelope(west, south, east, north, 4326) as geometry
  ),
  candidates as (
    select
      'node'::text as kind,
      n.source_record_id as feature_id,
      n.canonical_name as name,
      coalesce(o.canonical_name, n.operator_name) as operator,
      n.voltage_kv,
      n.operational_status as status,
      n.geometry,
      s.evidence_class,
      null::numeric as area_ha,
      null::text as planning_status,
      coalesce(c.observation_type, 'not_established') as capacity_state,
      c.exact_mw,
      c.band_min_mw,
      c.band_max_mw,
      c.confidence_grade,
      c.published_at as capacity_published_at,
      null::text as technology,
      null::numeric as net_capacity_mw,
      null::numeric as storage_energy_mwh,
      s.source_url
    from public.canonical_grid_nodes n
    join public.grid_sources s on s.id = n.source_id
    join bounds b on extensions.st_intersects(n.geometry, b.geometry)
    left join public.grid_operators o on o.id = n.operator_id
    left join lateral (
      select observation.*
      from public.public_capacity_observations observation
      where observation.node_id = n.id and observation.direction = 'demand'
      order by observation.published_at desc nulls last, observation.created_at desc
      limit 1
    ) c on true
    where n.source_artifact_id is null or exists (
      select 1 from public.grid_source_artifacts artifact
      where artifact.id = n.source_artifact_id and artifact.status = 'active'
    )

    union all

    select
      'line', l.source_record_id, coalesce(l.name, 'Mapped grid corridor'),
      l.operator_name, l.voltage_kv, l.operational_status, l.geometry,
      s.evidence_class, null, null, 'not_established',
      null, null, null, null, null, null, null, null, s.source_url
    from public.canonical_grid_lines l
    join public.grid_sources s on s.id = l.source_id
    join bounds b on extensions.st_intersects(l.geometry, b.geometry)
    where l.source_artifact_id is null or exists (
      select 1 from public.grid_source_artifacts artifact
      where artifact.id = l.source_artifact_id and artifact.status = 'active'
    )

    union all

    select
      'industrial_site', i.source_record_id, coalesce(i.name, 'Mapped industrial land'),
      null, '{}'::numeric[], 'unknown', i.geometry, s.evidence_class,
      i.area_ha, i.planning_status, 'not_established',
      null, null, null, null, null, null, null, null, s.source_url
    from public.canonical_industrial_sites i
    join public.grid_sources s on s.id = i.source_id
    join bounds b on extensions.st_intersects(i.geometry, b.geometry)
    where i.source_artifact_id is null or exists (
      select 1 from public.grid_source_artifacts artifact
      where artifact.id = i.source_artifact_id and artifact.status = 'active'
    )

    union all

    select
      case a.asset_type when 'storage' then 'storage_asset' else 'generation_asset' end,
      a.source_record_id,
      coalesce(a.canonical_name, a.source_record_id),
      a.grid_operator_name,
      '{}'::numeric[],
      a.operational_status,
      a.geometry,
      s.evidence_class,
      null, null, 'not_established',
      null, null, null, null, null,
      a.technology,
      a.net_capacity_mw,
      a.storage_energy_mwh,
      s.source_url
    from public.canonical_energy_assets a
    join public.grid_sources s on s.id = a.source_id
    join bounds b on a.geometry is not null and extensions.st_intersects(a.geometry, b.geometry)
    where a.asset_type in ('generation', 'storage')
      and a.location_precision in ('surveyed', 'mapped')
      and (a.asset_type <> 'generation' or include_generation)
      and (a.asset_type <> 'storage' or include_storage)
      and (a.source_artifact_id is null or exists (
        select 1 from public.grid_source_artifacts artifact
        where artifact.id = a.source_artifact_id and artifact.status = 'active'
      ))
  ),
  limited as (
    select *
    from candidates
    order by case kind
      when 'node' then 1
      when 'line' then 2
      when 'industrial_site' then 3
      when 'storage_asset' then 4
      when 'generation_asset' then 5
      else 6
    end, feature_id
    limit least(greatest(coalesce(max_features, 2500), 1), 2500)
  ),
  features as (
    select jsonb_build_object(
      'type', 'Feature',
      'id', feature_id,
      'geometry', extensions.st_asgeojson(geometry)::jsonb,
      'properties', jsonb_strip_nulls(jsonb_build_object(
        'kind', kind,
        'name', name,
        'operator', operator,
        'voltage_kv', to_jsonb(voltage_kv),
        'status', status,
        'evidence_class', evidence_class,
        'capacity_state', capacity_state,
        'exact_mw', exact_mw,
        'band_min_mw', band_min_mw,
        'band_max_mw', band_max_mw,
        'confidence_grade', confidence_grade,
        'capacity_published_at', capacity_published_at,
        'area_ha', area_ha,
        'planning_status', planning_status,
        'source_url', source_url,
        'technology', technology,
        'net_capacity_mw', net_capacity_mw,
        'storage_energy_mwh', storage_energy_mwh
      ))
    ) as feature
    from limited
  ),
  counts as (
    select kind, count(*)::integer as count from limited group by kind
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'metadata', jsonb_build_object(
      'title', 'GridPulse bounded public-source screening context',
      'source_id', 'canonical-power-finder-public-v1',
      'publisher', 'Attributed per feature',
      'licence', 'See source register and feature attribution',
      'attribution', 'OpenStreetMap contributors; Marktstammdatenregister (MaStR), Bundesnetzagentur',
      'published_at', now(),
      'geographic_scope', jsonb_build_array(west, south, east, north),
      'freshness', 'queried from active accepted source releases',
      'artifact_sha256', 'database-query-public-v1',
      'record_count', (select count(*) from features),
      'available_kinds', jsonb_build_array(
        'node', 'line', 'industrial_site', 'generation_asset', 'storage_asset'
      ),
      'kind_counts', coalesce(
        (select jsonb_object_agg(kind, count) from counts), '{}'::jsonb
      ),
      'evidence_boundary',
        'Public-source screening context. Registered asset MW is not available grid capacity. Operator confirmation remains required.'
    ),
    'features', coalesce((select jsonb_agg(feature) from features), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.power_finder_public_viewport(
  double precision, double precision, double precision, double precision,
  boolean, boolean, integer
) from public, anon, authenticated;

grant execute on function public.power_finder_public_viewport(
  double precision, double precision, double precision, double precision,
  boolean, boolean, integer
) to anon, authenticated;

comment on function public.power_finder_public_viewport(
  double precision, double precision, double precision, double precision,
  boolean, boolean, integer
) is 'Bounded, field-allowlisted, read-only public Finder data. No customer or internal records.';
