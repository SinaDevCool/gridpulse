create or replace function public.power_finder_public_registry_tile(
  z integer, x integer, y integer,
  include_generation boolean default true, include_storage boolean default true
)
returns bytea language sql stable security definer set search_path = '' set statement_timeout = '15s'
as $$
  with bounds as (select extensions.st_tileenvelope(z,x,y) geom_3857,extensions.st_transform(extensions.st_tileenvelope(z,x,y),4326) geom_4326),
  assets as materialized (
    select a.source_record_id id,case when a.asset_type='storage' then 'storage_asset' else 'generation_asset' end kind,
      coalesce(a.canonical_name,a.source_record_id) name,a.grid_operator_name operator,a.operational_status status,a.technology,
      case when a.asset_type='storage' then 'storage' when lower(coalesce(a.technology,'')) like '%solar%' then 'solar' when lower(coalesce(a.technology,'')) like '%wind%' then 'wind' when lower(coalesce(a.technology,'')) like '%biomass%' then 'biomass' when lower(coalesce(a.technology,'')) like '%wasser%' and lower(a.technology) not like '%wasserstoff%' then 'hydro' when lower(coalesce(a.technology,'')) like '%geotherm%' then 'geothermal' when lower(coalesce(a.technology,'')) like '%kern%' then 'nuclear' when lower(coalesce(a.technology,'')) similar to '%(erdgas|andere gase|grubengas)%' then 'gas' when lower(coalesce(a.technology,'')) similar to '%(mineralöl|steinkohle|braunkohle|nicht biogener abfall)%' then 'fossil_other' else 'other' end generation_group,
      a.net_capacity_mw::double precision net_capacity_mw,a.storage_energy_mwh::double precision storage_energy_mwh,s.source_url,a.geometry
    from public.canonical_energy_assets a join public.grid_sources s on s.id=a.source_id cross join bounds b
    where a.geometry is not null and a.location_precision in ('surveyed','mapped') and ((a.asset_type='generation' and include_generation) or (a.asset_type='storage' and include_storage)) and extensions.st_intersects(a.geometry,b.geom_4326)
    order by coalesce(a.net_capacity_mw,0) desc,a.source_record_id limit (case when z<9 then 500 when z=9 then 10000 else 20000 end)
  ), overview as (
    select md5(kind||generation_group||extensions.st_astext(extensions.st_snaptogrid(geometry,case when z<=6 then .35 else .12 end))) id,kind,generation_group,count(*)::integer asset_count,count(net_capacity_mw)::integer known_mw_count,sum(net_capacity_mw)::double precision registered_mw,extensions.st_centroid(extensions.st_collect(geometry)) geometry
    from assets where z<9 group by kind,generation_group,extensions.st_snaptogrid(geometry,case when z<=6 then .35 else .12 end)
  ), rows as (
    select id,kind,generation_group,asset_count,known_mw_count,registered_mw,null::text name,null::text operator,null::text status,null::text technology,null::double precision net_capacity_mw,null::double precision storage_energy_mwh,null::text source_url,geometry from overview
    union all select id,kind,generation_group,1,case when net_capacity_mw is null then 0 else 1 end,net_capacity_mw,name,operator,status,technology,net_capacity_mw,storage_energy_mwh,source_url,geometry from assets where z>=9
  ), mvt as (
    select r.id,r.kind,r.name,r.operator,r.status,r.technology,r.generation_group,r.asset_count,r.known_mw_count,r.registered_mw,r.net_capacity_mw,r.storage_energy_mwh,r.source_url,extensions.st_asmvtgeom(extensions.st_transform(r.geometry,3857),b.geom_3857,4096,64,true) geom from rows r cross join bounds b
  ) select coalesce(extensions.st_asmvt(mvt,'power_finder',4096,'geom'),''::bytea) from mvt
$$;
revoke all on function public.power_finder_public_registry_tile(integer,integer,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.power_finder_public_registry_tile(integer,integer,integer,boolean,boolean) to anon,authenticated;
