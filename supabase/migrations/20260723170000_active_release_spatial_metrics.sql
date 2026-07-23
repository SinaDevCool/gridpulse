-- Spatial context must ignore staged, rejected, superseded and rolled-back assets.

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
    and (
      asset.dataset_release_id is null
      or exists (
        select 1
        from public.grid_dataset_releases release
        where release.id = asset.dataset_release_id and release.status = 'active'
      )
    )
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
    'site-node-context-v2-active-releases',
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
    'calculation_version', 'site-node-context-v2-active-releases',
    'evidence_boundary',
      'Active-release proximity and evidence context only; no available capacity is inferred.'
  );
end;
$$;

revoke all on function public.refresh_power_finder_spatial_metrics()
  from public, anon, authenticated;
grant execute on function public.refresh_power_finder_spatial_metrics()
  to service_role;
