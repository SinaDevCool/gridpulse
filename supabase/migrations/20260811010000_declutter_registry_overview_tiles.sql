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
    select
      extensions.st_tileenvelope(z, x, y) as geom_3857,
      extensions.st_transform(extensions.st_tileenvelope(z, x, y), 4326) as geom_4326
  ), ranked as (
    select
      a.source_record_id as id,
      case when a.asset_type = 'storage' then 'storage_asset' else 'generation_asset' end as kind,
      coalesce(a.canonical_name, a.source_record_id) as name,
      a.grid_operator_name as operator,
      a.operational_status as status,
      a.net_capacity_mw::double precision as net_capacity_mw,
      a.storage_energy_mwh::double precision as storage_energy_mwh,
      s.source_url,
      a.geometry
    from public.canonical_energy_assets a
    join public.grid_sources s on s.id = a.source_id
    cross join bounds b
    where a.geometry is not null
      and a.location_precision in ('surveyed', 'mapped')
      and ((a.asset_type = 'generation' and include_generation)
        or (a.asset_type = 'storage' and include_storage))
      and extensions.st_intersects(a.geometry, b.geom_4326)
      and (a.source_artifact_id is null or exists (
        select 1
        from public.grid_source_artifacts artifact
        where artifact.id = a.source_artifact_id and artifact.status = 'active'
      ))
    order by
      case when a.asset_type = 'storage' then 0 else 1 end,
      coalesce(a.net_capacity_mw, 0) desc,
      a.source_record_id
    limit (case when z <= 8 then 5000 when z = 9 then 10000 else 20000 end)
  ), mvt as (
    select
      r.id,
      r.kind,
      r.name,
      r.operator,
      r.status,
      r.net_capacity_mw,
      r.storage_energy_mwh,
      r.source_url,
      extensions.st_asmvtgeom(
        extensions.st_transform(r.geometry, 3857),
        b.geom_3857,
        4096,
        64,
        true
      ) as geom
    from ranked r
    cross join bounds b
  )
  select coalesce(extensions.st_asmvt(mvt, 'power_finder', 4096, 'geom'), ''::bytea)
  from mvt
$$;

revoke all on function public.power_finder_public_registry_tile(integer,integer,integer,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.power_finder_public_registry_tile(integer,integer,integer,boolean,boolean)
  to anon, authenticated;
