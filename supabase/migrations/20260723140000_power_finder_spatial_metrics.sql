-- Reproducible spatial screening metrics. These functions calculate proximity
-- and context only; they do not estimate available connection capacity.

create or replace function public.refresh_power_finder_spatial_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_rows integer;
  metric_rows integer;
begin
  delete from public.grid_node_asset_context;

  insert into public.grid_node_asset_context (
    node_id, radius_km, generation_mw, storage_mw, storage_mwh,
    operational_asset_count, planned_asset_count, technology_mix,
    source_release_ids, calculated_at
  )
  select
    node.id,
    radius.value,
    coalesce(sum(asset.net_capacity_mw) filter (where asset.asset_type = 'generation'), 0),
    coalesce(sum(asset.net_capacity_mw) filter (where asset.asset_type = 'storage'), 0),
    coalesce(sum(asset.storage_energy_mwh) filter (where asset.asset_type = 'storage'), 0),
    count(asset.id) filter (where asset.operational_status = 'operational'),
    count(asset.id) filter (where asset.operational_status in ('planned','construction')),
    '{}'::jsonb,
    coalesce(array_agg(distinct asset.source_artifact_id)
      filter (where asset.source_artifact_id is not null), '{}'),
    now()
  from public.canonical_grid_nodes node
  cross join unnest(array[5,10,20,50]) as radius(value)
  left join public.canonical_energy_assets asset
    on asset.geometry is not null
    and extensions.st_dwithin(
      node.geometry::extensions.geography,
      asset.geometry::extensions.geography,
      radius.value * 1000
    )
  group by node.id, radius.value;

  get diagnostics context_rows = row_count;

  delete from public.site_node_metrics;

  insert into public.site_node_metrics (
    site_id, node_id, straight_line_distance_km, voltage_compatibility,
    context_score, evidence_score, missing_evidence, calculation_version, calculated_at
  )
  select
    site.id,
    node.id,
    round((
      extensions.st_distance(
        extensions.st_centroid(site.geometry)::extensions.geography,
        node.geometry::extensions.geography
      ) / 1000
    )::numeric, 3),
    case
      when coalesce(array_length(node.voltage_kv, 1), 0) = 0 then 'unknown'
      when (select max(value) from unnest(node.voltage_kv) value) >= 110 then 'compatible'
      else 'conditional'
    end,
    least(
      100,
      (case
        when (select max(value) from unnest(node.voltage_kv) value) >= 380 then 35
        when (select max(value) from unnest(node.voltage_kv) value) >= 220 then 30
        when (select max(value) from unnest(node.voltage_kv) value) >= 110 then 24
        when coalesce(array_length(node.voltage_kv, 1), 0) > 0 then 12
        else 0
      end)
      + (case when node.operator_name is not null or node.operator_id is not null then 15 else 0 end)
      + (case when node.operational_status = 'operational' then 10 else 5 end)
      + round(node.identity_confidence * 25)::integer
    ),
    least(100,
      (case source.evidence_class
        when 'official_operator' then 80
        when 'official_regulatory' then 70
        when 'official_public' then 60
        when 'open_mapping' then 35
        else 10
      end) + round(node.identity_confidence * 20)::integer
    ),
    array_remove(array[
      case when coalesce(array_length(node.voltage_kv, 1), 0) = 0 then 'voltage' end,
      case when node.operator_name is null and node.operator_id is null then 'responsible operator' end,
      'available demand capacity',
      'connection feasibility',
      'delivery date'
    ], null),
    'site-node-context-v1',
    now()
  from public.canonical_industrial_sites site
  join public.canonical_grid_nodes node
    on extensions.st_dwithin(
      extensions.st_centroid(site.geometry)::extensions.geography,
      node.geometry::extensions.geography,
      50000
    )
  join public.grid_sources source on source.id = node.source_id;

  get diagnostics metric_rows = row_count;

  return jsonb_build_object(
    'node_asset_context_rows', context_rows,
    'site_node_metric_rows', metric_rows,
    'calculation_version', 'site-node-context-v1',
    'evidence_boundary',
      'Proximity and evidence-context metrics only; no available capacity is inferred.'
  );
end;
$$;

revoke all on function public.refresh_power_finder_spatial_metrics() from public, anon, authenticated;
grant execute on function public.refresh_power_finder_spatial_metrics() to service_role;

create or replace function public.power_finder_ranked_candidates(
  required_import_mw numeric,
  max_distance_km numeric default 20,
  result_limit integer default 25
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      metric.site_id,
      metric.node_id,
      site.name as site_name,
      node.canonical_name as node_name,
      node.operator_name,
      node.voltage_kv,
      metric.straight_line_distance_km,
      metric.context_score,
      metric.evidence_score,
      metric.missing_evidence,
      case
        when required_import_mw >= 100
          and coalesce((select max(value) from unnest(node.voltage_kv) value), 0) < 220
          then 'conditional'
        when required_import_mw >= 20
          and coalesce((select max(value) from unnest(node.voltage_kv) value), 0) < 110
          then 'conditional'
        when coalesce(array_length(node.voltage_kv, 1), 0) = 0 then 'unknown'
        else 'compatible'
      end as project_voltage_fit,
      round((
        metric.context_score * 0.45
        + metric.evidence_score * 0.35
        + greatest(0, 100 - metric.straight_line_distance_km * 5) * 0.20
      )::numeric, 1) as screening_rank
    from public.site_node_metrics metric
    join public.canonical_industrial_sites site on site.id = metric.site_id
    join public.canonical_grid_nodes node on node.id = metric.node_id
    where metric.straight_line_distance_km <= least(greatest(max_distance_km, 0.1), 100)
  )
  select jsonb_build_object(
    'required_import_mw', required_import_mw,
    'max_distance_km', max_distance_km,
    'calculation_version', 'site-node-context-v1',
    'evidence_boundary',
      'Ranks screening context, evidence and proximity. It does not estimate capacity, cost or connection probability.',
    'candidates', coalesce(
      (select jsonb_agg(to_jsonb(candidate))
       from (
         select *
         from ranked
         order by screening_rank desc, straight_line_distance_km
         limit least(greatest(coalesce(result_limit, 25), 1), 100)
       ) candidate),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.power_finder_ranked_candidates(numeric, numeric, integer)
  from public, anon;
grant execute on function public.power_finder_ranked_candidates(numeric, numeric, integer)
  to authenticated;
