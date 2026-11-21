-- Build globally aligned low-zoom registry cells before snapshot activation.
create table if not exists finder_public.registry_overview (
 snapshot_id text not null references finder_public.snapshots(id),
 zoom_level integer not null check (zoom_level between 4 and 7),
 id text not null,
 kind text not null,
 properties jsonb not null,
 geometry public.geometry(Point,3857) not null,
 primary key(snapshot_id,zoom_level,id)
);
create index if not exists finder_overview_geometry_idx
 on finder_public.registry_overview using gist(geometry);
revoke all on finder_public.registry_overview from public;

create or replace function finder_public.build_overview(s text, zoom integer)
returns bigint language plpgsql set search_path='' as $$
declare inserted bigint;
begin
 if zoom not between 4 and 7 then raise exception 'Invalid overview zoom'; end if;
 if not exists(select 1 from finder_public.snapshots where id=s and activated_at is null)
 then raise exception 'Snapshot is absent or immutable'; end if;
 with points as (
   select kind,properties,public.st_transform(geometry,3857) geom
   from finder_public.features where snapshot_id=s and kind in ('generation_asset','storage_asset')
 ), cells as (
   select *,public.st_snaptogrid(geom,case zoom when 4 then 192000 when 5 then 96000
      when 6 then 48000 else 24000 end) cell from points
 )
 insert into finder_public.registry_overview(snapshot_id,zoom_level,id,kind,properties,geometry)
 select s,zoom,md5(concat(zoom,kind,properties->>'generation_group',public.st_astext(cell))),kind,
   jsonb_build_object('name',concat(count(*),' registered assets'),'status','aggregate',
     'generation_group',properties->>'generation_group','asset_count',count(*),
     'known_mw_count',count(properties->>'net_capacity_mw'),
     'net_capacity_mw',sum((properties->>'net_capacity_mw')::double precision),
     'registered_mw',sum((properties->>'net_capacity_mw')::double precision),
     'storage_energy_mwh',sum((properties->>'storage_energy_mwh')::double precision)),
   public.st_setsrid(public.st_makepoint(avg(public.st_x(geom)),avg(public.st_y(geom))),3857)
 from cells group by kind,properties->>'generation_group',cell
 on conflict do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end $$;
revoke all on function finder_public.build_overview(text,integer) from public;
