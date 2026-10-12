-- Reuse the precomputed national overview at z4-z7. At regional zooms,
-- aggregate only real MaStR records intersecting the requested tile.
create or replace function public.power_finder_public_registry_tile(
  z integer,x integer,y integer,
  include_generation boolean default true,include_storage boolean default true
) returns bytea language sql stable security definer set search_path = '' set statement_timeout = '15s' as $$
  with bounds as (
    select extensions.st_tileenvelope(z,x,y) geom_3857,
      extensions.st_transform(extensions.st_tileenvelope(z,x,y),4326) geom_4326
  ), national_overview as (
    select o.id,o.kind,concat(o.asset_count,' registered assets') name,
      null::text operator,'aggregate'::text status,null::text technology,o.generation_group,
      o.net_capacity_mw,o.storage_energy_mwh,null::text source_url,o.asset_count,o.geom
    from public.power_finder_registry_overview o cross join bounds b
    where z < 8 and o.zoom_level=greatest(4,least(7,z))
      and ((o.kind='generation_asset' and include_generation) or (o.kind='storage_asset' and include_storage))
      and extensions.st_intersects(o.geom,b.geom_3857)
  ), regional_base as (
    select case when a.asset_type='storage' then 'storage_asset' else 'generation_asset' end kind,
      public.power_finder_generation_group(a.asset_type,a.technology) generation_group,
      a.net_capacity_mw::double precision net_capacity_mw,
      a.storage_energy_mwh::double precision storage_energy_mwh,
      extensions.st_transform(a.geometry,3857) geom
    from public.canonical_energy_assets a cross join bounds b
    where z between 8 and 10 and a.geometry is not null and a.location_precision in ('surveyed','mapped')
      and ((a.asset_type='generation' and include_generation) or (a.asset_type='storage' and include_storage))
      and extensions.st_intersects(a.geometry,b.geom_4326)
      and (a.source_artifact_id is null or exists (
        select 1 from public.grid_source_artifacts artifact
        where artifact.id=a.source_artifact_id and artifact.status='active'))
  ), regional_overview as (
    select md5(concat(z,'|',kind,'|',generation_group,'|',
        extensions.st_x(extensions.st_snaptogrid(geom,case z when 8 then 2500 when 9 then 1250 else 625 end)),'|',
        extensions.st_y(extensions.st_snaptogrid(geom,case z when 8 then 2500 when 9 then 1250 else 625 end)))) id,
      kind,concat(count(*),' registered assets') name,null::text operator,'aggregate'::text status,
      null::text technology,generation_group,
      sum(coalesce(net_capacity_mw,0))::double precision net_capacity_mw,
      sum(coalesce(storage_energy_mwh,0))::double precision storage_energy_mwh,
      null::text source_url,count(*)::integer asset_count,
      extensions.st_centroid(extensions.st_collect(geom)) geom
    from regional_base
    group by kind,generation_group,
      extensions.st_snaptogrid(geom,case z when 8 then 2500 when 9 then 1250 else 625 end)
  ), exact as (
    select a.source_record_id::text id,
      case when a.asset_type='storage' then 'storage_asset' else 'generation_asset' end kind,
      coalesce(a.canonical_name,a.source_record_id) name,a.grid_operator_name operator,
      a.operational_status status,a.technology,
      public.power_finder_generation_group(a.asset_type,a.technology) generation_group,
      a.net_capacity_mw::double precision net_capacity_mw,
      a.storage_energy_mwh::double precision storage_energy_mwh,s.source_url,
      1::integer asset_count,extensions.st_transform(a.geometry,3857) geom
    from public.canonical_energy_assets a join public.grid_sources s on s.id=a.source_id cross join bounds b
    where z>=11 and a.geometry is not null and a.location_precision in ('surveyed','mapped')
      and ((a.asset_type='generation' and include_generation) or (a.asset_type='storage' and include_storage))
      and extensions.st_intersects(a.geometry,b.geom_4326)
      and (a.source_artifact_id is null or exists (
        select 1 from public.grid_source_artifacts artifact
        where artifact.id=a.source_artifact_id and artifact.status='active'))
  ), display as (
    select * from national_overview union all select * from regional_overview union all select * from exact
  ), limited as (select * from display order by net_capacity_mw desc nulls last,id limit 20000),
  mvt as (
    select d.id,d.kind,d.name,d.operator,d.status,d.technology,d.generation_group,
      d.net_capacity_mw,d.storage_energy_mwh,d.source_url,d.asset_count,
      extensions.st_asmvtgeom(d.geom,b.geom_3857,4096,64,true) geom
    from limited d cross join bounds b where not extensions.st_isempty(d.geom)
  )
  select coalesce(extensions.st_asmvt(mvt,'power_finder',4096,'geom'),''::bytea) from mvt
$$;

revoke all on function public.power_finder_public_registry_tile(integer,integer,integer,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.power_finder_public_registry_tile(integer,integer,integer,boolean,boolean)
  to anon,authenticated;
