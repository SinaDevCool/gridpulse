-- Bounded, authenticated GeoJSON query for the Power Finder.
-- The function exposes public screening context, not project-specific capacity.

create or replace function public.power_finder_viewport(
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  max_features integer default 2000
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select extensions.st_makeenvelope(west, south, east, north, 4326) as geometry
    where west < east and south < north
  ),
  candidates as (
    select
      'node'::text as kind,
      n.source_record_id as feature_id,
      n.canonical_name as name,
      n.operator_name as operator,
      n.voltage_kv,
      n.operational_status as status,
      n.geometry,
      s.evidence_class,
      n.metadata,
      null::numeric as area_ha,
      null::text as planning_status,
      coalesce(c.observation_type, 'not_established') as capacity_state,
      c.exact_mw,
      c.band_min_mw,
      c.band_max_mw,
      c.confidence_grade,
      c.published_at as capacity_published_at
    from public.canonical_grid_nodes n
    join public.grid_sources s on s.id = n.source_id
    join bounds b on extensions.st_intersects(n.geometry, b.geometry)
    left join lateral (
      select o.*
      from public.public_capacity_observations o
      where o.node_id = n.id and o.direction = 'demand'
      order by o.published_at desc nulls last, o.created_at desc
      limit 1
    ) c on true

    union all

    select
      'line', l.source_record_id, coalesce(l.name, 'Mapped grid corridor'),
      l.operator_name, l.voltage_kv, l.operational_status, l.geometry,
      s.evidence_class, l.metadata, null, null, 'not_established',
      null, null, null, null, null
    from public.canonical_grid_lines l
    join public.grid_sources s on s.id = l.source_id
    join bounds b on extensions.st_intersects(l.geometry, b.geometry)

    union all

    select
      'industrial_site', i.source_record_id, coalesce(i.name, 'Mapped industrial land'),
      null, '{}'::numeric[], 'unknown', i.geometry, s.evidence_class, i.metadata,
      i.area_ha, i.planning_status, 'not_established',
      null, null, null, null, null
    from public.canonical_industrial_sites i
    join public.grid_sources s on s.id = i.source_id
    join bounds b on extensions.st_intersects(i.geometry, b.geometry)
  ),
  limited as (
    select *
    from candidates
    order by
      case kind when 'node' then 1 when 'industrial_site' then 2 else 3 end,
      feature_id
    limit least(greatest(coalesce(max_features, 2000), 1), 5000)
  ),
  features as (
    select jsonb_build_object(
      'type', 'Feature',
      'id', feature_id,
      'geometry', extensions.st_asgeojson(geometry)::jsonb,
      'properties', jsonb_build_object(
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
        'source_url', metadata ->> 'source_url'
      )
    ) as feature
    from limited
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'metadata', jsonb_build_object(
      'title', 'GridPulse bounded public-source screening context',
      'source_id', 'canonical-power-finder',
      'publisher', 'Attributed per feature',
      'licence', 'See source register and feature attribution',
      'attribution', 'OpenStreetMap contributors and registered public sources',
      'published_at', now(),
      'geographic_scope', jsonb_build_array(west, south, east, north),
      'freshness', 'queried live from the accepted source release',
      'artifact_sha256', 'database-query',
      'record_count', (select count(*) from features),
      'evidence_boundary',
        'Screening context only. Capacity is shown only when a classified public observation exists; operator confirmation remains required.'
    ),
    'features', coalesce((select jsonb_agg(feature) from features), '[]'::jsonb)
  );
$$;

revoke all on function public.power_finder_viewport(
  double precision, double precision, double precision, double precision, integer
) from public, anon;

grant execute on function public.power_finder_viewport(
  double precision, double precision, double precision, double precision, integer
) to authenticated;

comment on function public.power_finder_viewport is
  'Returns bounded, classified screening GeoJSON. It does not infer missing connection capacity.';
