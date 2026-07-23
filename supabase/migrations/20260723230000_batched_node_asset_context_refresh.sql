-- API-safe incremental refresh for MaStR-dependent context. Site-to-node
-- topology metrics are independent of asset releases and remain unchanged.

create or replace function public.refresh_grid_node_asset_context_batch(
  p_offset integer default 0,
  p_limit integer default 25
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  refreshed integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  delete from public.grid_node_asset_context context
  where context.node_id in (
    select node.id
    from public.canonical_grid_nodes node
    order by node.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  );

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
  from (
    select candidate.id, candidate.geometry
    from public.canonical_grid_nodes candidate
    order by candidate.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  ) node
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

  get diagnostics refreshed = row_count;
  return refreshed;
end;
$$;

revoke all on function public.refresh_grid_node_asset_context_batch(integer, integer)
  from public, anon, authenticated;
grant execute on function public.refresh_grid_node_asset_context_batch(integer, integer)
  to service_role;
