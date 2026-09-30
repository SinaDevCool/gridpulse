-- Germany-wide MaStR overview tiles. Low zooms publish deterministic spatial
-- aggregates; investigable zooms retain exact published points. Registered MW
-- remains asset context and never represents connection capacity.
create or replace function public.power_finder_public_registry_tile(
  z integer,
  x integer,
  y integer,
  include_generation boolean default true,
  include_storage boolean default true
)
returns bytea
language sql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
  with bounds as (
    select extensions.st_tileenvelope(z, x, y) geom_3857,
      extensions.st_transform(extensions.st_tileenvelope(z, x, y), 4326) geom_4326
  ), base as (
    select a.source_record_id id,
      case when a.asset_type='storage' then 'storage_asset' else 'generation_asset' end kind,
      coalesce(a.canonical_name,a.source_record_id) name,
      a.grid_operator_name operator,a.operational_status status,a.technology,
      case
        when a.asset_type='storage' then 'storage'
        when lower(coalesce(a.technology,'')) like '%solar%' then 'solar'
        when lower(coalesce(a.technology,'')) like '%wind%' then 'wind'
        when lower(coalesce(a.technology,'')) like '%biomass%' then 'biomass'
        when lower(coalesce(a.technology,'')) like '%wasser%' and lower(a.technology) not like '%wasserstoff%' then 'hydro'
        when lower(coalesce(a.technology,'')) like '%geotherm%' then 'geothermal'
        when lower(coalesce(a.technology,'')) like '%kern%' then 'nuclear'
        when lower(coalesce(a.technology,'')) similar to '%(erdgas|andere gase|grubengas)%' then 'gas'
        when lower(coalesce(a.technology,'')) similar to '%(mineralöl|steinkohle|braunkohle|nicht biogener abfall)%' then 'fossil_other'
        else 'other' end generation_group,
      a.net_capacity_mw::double precision net_capacity_mw,
      a.storage_energy_mwh::double precision storage_energy_mwh,
      s.source_url,extensions.st_transform(a.geometry,3857) geom
    from public.canonical_energy_assets a
    join public.grid_sources s on s.id=a.source_id cross join bounds b
    where a.geometry is not null and a.location_precision in ('surveyed','mapped')
      and ((a.asset_type='generation' and include_generation) or
           (a.asset_type='storage' and include_storage))
      and extensions.st_intersects(a.geometry,b.geom_4326)
      and (a.source_artifact_id is null or exists (
        select 1 from public.grid_source_artifacts artifact
        where artifact.id=a.source_artifact_id and artifact.status='active'))
  ), overview as (
    select concat('aggregate-',z,'-',x,'-',y,'-',kind,'-',generation_group,'-',
        extensions.st_x(extensions.st_snaptogrid(geom,case when z<=4 then 40000 when z=5 then 20000 when z=6 then 10000 else 5000 end)),'-',
        extensions.st_y(extensions.st_snaptogrid(geom,case when z<=4 then 40000 when z=5 then 20000 when z=6 then 10000 else 5000 end))) id,
      kind,concat(count(*),' registered assets') name,null::text operator,'aggregate'::text status,
      null::text technology,generation_group,sum(coalesce(net_capacity_mw,0)) net_capacity_mw,
      sum(coalesce(storage_energy_mwh,0)) storage_energy_mwh,null::text source_url,
      count(*)::integer asset_count,
      extensions.st_centroid(extensions.st_collect(geom)) geom
    from base where z<8
    group by kind,generation_group,
      extensions.st_snaptogrid(geom,case when z<=4 then 40000 when z=5 then 20000 when z=6 then 10000 else 5000 end)
  ), display as (
    select id,kind,name,operator,status,technology,generation_group,net_capacity_mw,
      storage_energy_mwh,source_url,asset_count,geom from overview
    union all
    select id,kind,name,operator,status,technology,generation_group,net_capacity_mw,
      storage_energy_mwh,source_url,1::integer,geom from base where z>=8
  ), limited as (
    select * from display order by net_capacity_mw desc nulls last,id limit 20000
  ), mvt as (
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

