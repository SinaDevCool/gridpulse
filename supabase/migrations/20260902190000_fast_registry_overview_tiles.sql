-- Precompute the governed low-zoom registry projection. Runtime tile requests
-- must never scan and aggregate the full MaStR release.
create or replace function public.power_finder_generation_group(
  asset_type text,
  technology text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when asset_type = 'storage' then 'storage'
    when lower(coalesce(technology,'')) like '%solar%' then 'solar'
    when lower(coalesce(technology,'')) like '%wind%' then 'wind'
    when lower(coalesce(technology,'')) like '%biomass%' then 'biomass'
    when lower(coalesce(technology,'')) like '%wasser%'
      and lower(coalesce(technology,'')) not like '%wasserstoff%' then 'hydro'
    when lower(coalesce(technology,'')) like '%geotherm%' then 'geothermal'
    when lower(coalesce(technology,'')) like '%kern%' then 'nuclear'
    when lower(coalesce(technology,'')) similar to '%(erdgas|andere gase|grubengas)%' then 'gas'
    when lower(coalesce(technology,'')) similar to
      '%(mineralöl|steinkohle|braunkohle|nicht biogener abfall)%' then 'fossil_other'
    else 'other'
  end
$$;

revoke all on function public.power_finder_generation_group(text,text)
  from public,anon,authenticated;

create materialized view public.power_finder_registry_overview as
with eligible as (
  select
    case when a.asset_type = 'storage' then 'storage_asset' else 'generation_asset' end kind,
    public.power_finder_generation_group(a.asset_type,a.technology) generation_group,
    a.net_capacity_mw::double precision net_capacity_mw,
    a.storage_energy_mwh::double precision storage_energy_mwh,
    extensions.st_transform(a.geometry,3857) geom
  from public.canonical_energy_assets a
  where a.geometry is not null
    and a.location_precision in ('surveyed','mapped')
    and (a.source_artifact_id is null or exists (
      select 1 from public.grid_source_artifacts artifact
      where artifact.id = a.source_artifact_id and artifact.status = 'active'
    ))
), levels(zoom_level,cell_m) as (
  values (4,40000::double precision),(5,20000),(6,10000),(7,5000)
), cells as (
  select l.zoom_level,e.kind,e.generation_group,e.net_capacity_mw,e.storage_energy_mwh,
    extensions.st_snaptogrid(e.geom,l.cell_m) geom
  from eligible e cross join levels l
)
select
  md5(concat(zoom_level,'|',kind,'|',generation_group,'|',
    extensions.st_x(geom),'|',extensions.st_y(geom))) id,
  zoom_level,
  kind,
  generation_group,
  sum(coalesce(net_capacity_mw,0))::double precision net_capacity_mw,
  sum(coalesce(storage_energy_mwh,0))::double precision storage_energy_mwh,
  count(*)::integer asset_count,
  geom
from cells
group by zoom_level,kind,generation_group,geom
with data;

create unique index power_finder_registry_overview_id_idx
  on public.power_finder_registry_overview(id);
create index power_finder_registry_overview_zoom_geom_idx
  on public.power_finder_registry_overview using gist(geom);
create index power_finder_registry_overview_zoom_idx
  on public.power_finder_registry_overview(zoom_level);

revoke all on public.power_finder_registry_overview from public,anon,authenticated;

comment on materialized view public.power_finder_registry_overview is
  'Governed MaStR low-zoom projection. Refresh concurrently after activating a new canonical energy-asset release.';

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
    select extensions.st_tileenvelope(z,x,y) geom_3857,
      extensions.st_transform(extensions.st_tileenvelope(z,x,y),4326) geom_4326
  ), overview as (
    select o.id,o.kind,concat(o.asset_count,' registered assets') name,
      null::text operator,'aggregate'::text status,null::text technology,o.generation_group,
      o.net_capacity_mw,o.storage_energy_mwh,null::text source_url,o.asset_count,o.geom
    from public.power_finder_registry_overview o cross join bounds b
    where z < 8 and o.zoom_level = greatest(4,least(7,z))
      and ((o.kind = 'generation_asset' and include_generation)
        or (o.kind = 'storage_asset' and include_storage))
      and extensions.st_intersects(o.geom,b.geom_3857)
  ), exact as (
    select a.source_record_id::text id,
      case when a.asset_type='storage' then 'storage_asset' else 'generation_asset' end kind,
      coalesce(a.canonical_name,a.source_record_id) name,a.grid_operator_name operator,
      a.operational_status status,a.technology,
      public.power_finder_generation_group(a.asset_type,a.technology) generation_group,
      a.net_capacity_mw::double precision net_capacity_mw,
      a.storage_energy_mwh::double precision storage_energy_mwh,s.source_url,
      1::integer asset_count,extensions.st_transform(a.geometry,3857) geom
    from public.canonical_energy_assets a
    join public.grid_sources s on s.id=a.source_id cross join bounds b
    where z >= 8 and a.geometry is not null and a.location_precision in ('surveyed','mapped')
      and ((a.asset_type='generation' and include_generation)
        or (a.asset_type='storage' and include_storage))
      and extensions.st_intersects(a.geometry,b.geom_4326)
      and (a.source_artifact_id is null or exists (
        select 1 from public.grid_source_artifacts artifact
        where artifact.id=a.source_artifact_id and artifact.status='active'
      ))
  ), display as (
    select * from overview union all select * from exact
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
