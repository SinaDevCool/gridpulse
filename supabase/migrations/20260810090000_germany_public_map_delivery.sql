-- Germany-wide public query bounds and scalable vector-tile delivery.
-- This migration changes delivery capability only. It does not claim or create
-- national coverage; features remain visible only from active accepted artifacts.

do $$
declare
  definition text;
  updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_viewport(double precision,double precision,double precision,double precision,boolean,boolean,integer)'::regprocedure
  ) into definition;
  updated := replace(
    definition,
    'or west < 10.5 or east > 15.2 or south < 50.8 or north > 54.0
     or east - west > 4.7 or north - south > 3.2',
    'or west < 5.8 or east > 15.1 or south < 47.2 or north > 55.2
     or (east - west) * (north - south) > 6.0'
  );
  updated := replace(updated, 'Invalid or unsupported Brandenburg viewport',
    'Invalid German viewport or query area exceeds limit');
  if updated = definition then
    raise exception 'Public viewport definition did not match expected Brandenburg gate';
  end if;
  execute updated;
end;
$$;

create or replace function public.power_finder_public_coverage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with active as (
    select r.source_id, r.id, r.geographic_scope, r.record_count,
      r.activated_at, r.validation_report, a.sha256, a.last_modified
    from public.grid_dataset_releases r
    join public.grid_source_artifacts a on a.id = r.source_artifact_id
    where r.status = 'active' and a.status = 'active'
  )
  select jsonb_build_object(
    'coverage_status', case
      when exists (select 1 from active where geographic_scope = 'Germany') then 'national_accepted'
      when exists (select 1 from active) then 'partial'
      else 'unavailable'
    end,
    'geographic_scope', 'Germany',
    'releases', coalesce((select jsonb_agg(jsonb_build_object(
      'source_id', source_id, 'release_id', id, 'scope', geographic_scope,
      'record_count', record_count, 'activated_at', activated_at,
      'source_sha256', sha256, 'source_last_modified', last_modified,
      'layer_counts', validation_report -> 'counts'
    )) from active), '[]'::jsonb),
    'evidence_boundary',
      'OSM is mapped infrastructure; MaStR MW is registered asset context. Neither is available grid capacity.'
  );
$$;

create or replace function public.power_finder_public_tile(
  z integer, x integer, y integer,
  include_generation boolean default true,
  include_storage boolean default true
)
returns bytea
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tile bytea;
begin
  if z < 4 or z > 16 or x < 0 or y < 0 or x >= (1 << z) or y >= (1 << z) then
    raise exception 'Invalid tile coordinate' using errcode = '22023';
  end if;
  with tile_bounds as (
    select extensions.st_tileenvelope(z, x, y) geom
  ), candidates as (
    select n.source_record_id id, 'node'::text kind, n.canonical_name name,
      n.operator_name operator, n.operational_status status, n.voltage_kv,
      'not_established'::text capacity_state, s.source_url,
      extensions.st_transform(n.geometry, 3857) geom
    from public.canonical_grid_nodes n
    join public.grid_sources s on s.id = n.source_id
    join tile_bounds b on extensions.st_intersects(extensions.st_transform(n.geometry, 3857), b.geom)
    where (z >= 7 or coalesce(n.voltage_kv[1], 0) >= 110)
      and (n.source_artifact_id is null or exists (
        select 1 from public.grid_source_artifacts a where a.id=n.source_artifact_id and a.status='active'))
    union all
    select l.source_record_id, 'line', coalesce(l.name, 'Mapped grid corridor'),
      l.operator_name, l.operational_status, l.voltage_kv, 'not_established', s.source_url,
      extensions.st_simplifypreservetopology(extensions.st_transform(l.geometry,3857),
        case when z < 7 then 500 when z < 10 then 80 else 5 end)
    from public.canonical_grid_lines l
    join public.grid_sources s on s.id=l.source_id
    join tile_bounds b on extensions.st_intersects(extensions.st_transform(l.geometry,3857), b.geom)
    where (l.source_artifact_id is null or exists (
      select 1 from public.grid_source_artifacts a where a.id=l.source_artifact_id and a.status='active'))
    union all
    select i.source_record_id, 'industrial_site', coalesce(i.name,'Mapped industrial land'),
      null, 'unknown', '{}'::numeric[], 'not_established', s.source_url,
      extensions.st_transform(i.geometry,3857)
    from public.canonical_industrial_sites i
    join public.grid_sources s on s.id=i.source_id
    join tile_bounds b on z >= 11 and extensions.st_intersects(extensions.st_transform(i.geometry,3857), b.geom)
    where (i.source_artifact_id is null or exists (
      select 1 from public.grid_source_artifacts a where a.id=i.source_artifact_id and a.status='active'))
    union all
    select a.source_record_id,
      case when a.asset_type='storage' then 'storage_asset' else 'generation_asset' end,
      coalesce(a.canonical_name,a.source_record_id), a.grid_operator_name,
      a.operational_status, '{}'::numeric[], 'registered_asset_context', s.source_url,
      extensions.st_transform(a.geometry,3857)
    from public.canonical_energy_assets a
    join public.grid_sources s on s.id=a.source_id
    join tile_bounds b on a.geometry is not null and extensions.st_intersects(extensions.st_transform(a.geometry,3857), b.geom)
    where z >= 8 and a.location_precision in ('surveyed','mapped')
      and ((a.asset_type='generation' and include_generation) or (a.asset_type='storage' and include_storage))
      and (a.source_artifact_id is null or exists (
        select 1 from public.grid_source_artifacts f where f.id=a.source_artifact_id and f.status='active'))
  ), mvt as (
    select id, kind, name, operator, status, voltage_kv::text, capacity_state, source_url,
      extensions.st_asmvtgeom(c.geom, b.geom, 4096, 64, true) geom
    from candidates c cross join tile_bounds b
    where not extensions.st_isempty(c.geom)
    order by case kind when 'node' then 1 when 'line' then 2 when 'industrial_site' then 3 when 'storage_asset' then 4 else 5 end, id
    limit 20000
  )
  select extensions.st_asmvt(mvt, 'power_finder', 4096, 'geom') into tile from mvt;
  return coalesce(tile, ''::bytea);
end;
$$;

revoke all on function public.power_finder_public_coverage() from public, anon, authenticated;
revoke all on function public.power_finder_public_tile(integer,integer,integer,boolean,boolean) from public, anon, authenticated;
grant execute on function public.power_finder_public_coverage() to anon, authenticated;
grant execute on function public.power_finder_public_tile(integer,integer,integer,boolean,boolean) to anon, authenticated;

create index if not exists canonical_energy_assets_geometry_gist_idx
  on public.canonical_energy_assets using gist (geometry) where geometry is not null;

-- Canonical OSM replacement is staged separately so active rows are untouched
-- until mandatory validation has passed and promotion starts its transaction.
alter table public.canonical_grid_nodes add column if not exists dataset_release_id uuid
  references public.grid_dataset_releases(id) on delete set null;
alter table public.canonical_grid_lines add column if not exists dataset_release_id uuid
  references public.grid_dataset_releases(id) on delete set null;
alter table public.canonical_industrial_sites add column if not exists dataset_release_id uuid
  references public.grid_dataset_releases(id) on delete set null;

create unlogged table if not exists public.grid_osm_release_staging (
  release_id uuid not null references public.grid_dataset_releases(id) on delete cascade,
  kind text not null check (kind in ('node','line','industrial_site')),
  source_record_id text not null,
  name text,
  operator_name text,
  voltage_kv jsonb not null default '[]'::jsonb,
  operational_status text not null,
  geometry jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (release_id, kind, source_record_id)
);
revoke all on public.grid_osm_release_staging from public, anon, authenticated;

create or replace function public.promote_osm_grid_release(p_release_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.grid_dataset_releases;
  staged_count bigint;
  node_count bigint;
  line_count bigint;
  site_count bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select * into target from public.grid_dataset_releases where id=p_release_id for update;
  if target.id is null or target.status <> 'validating'
     or coalesce((target.validation_report->>'valid')::boolean,false) is not true then
    raise exception 'accepted validating release required';
  end if;
  select count(*), count(*) filter(where kind='node'), count(*) filter(where kind='line'),
    count(*) filter(where kind='industrial_site')
  into staged_count,node_count,line_count,site_count
  from public.grid_osm_release_staging where release_id=p_release_id;
  if staged_count=0 or staged_count <> target.record_count then
    raise exception 'staged count % does not match release count %', staged_count,target.record_count;
  end if;

  insert into public.canonical_grid_nodes(source_id,source_artifact_id,dataset_release_id,
    source_record_id,canonical_name,node_type,operator_name,voltage_kv,geometry,
    operational_status,location_precision,confidence,metadata,last_seen_at)
  select target.source_id,target.source_artifact_id,p_release_id,s.source_record_id,
    coalesce(s.name,'Mapped substation'), 'substation',s.operator_name,
    array(select jsonb_array_elements_text(s.voltage_kv)::numeric),
    extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326)::extensions.geometry(Point,4326),
    s.operational_status,'mapped','medium',s.metadata,now()
  from public.grid_osm_release_staging s where s.release_id=p_release_id and s.kind='node'
  on conflict(source_id,source_record_id) do update set
    source_artifact_id=excluded.source_artifact_id,dataset_release_id=excluded.dataset_release_id,
    canonical_name=excluded.canonical_name,operator_name=excluded.operator_name,
    voltage_kv=excluded.voltage_kv,geometry=excluded.geometry,
    operational_status=excluded.operational_status,metadata=excluded.metadata,last_seen_at=now();

  insert into public.canonical_grid_lines(source_id,source_artifact_id,dataset_release_id,
    source_record_id,name,operator_name,voltage_kv,underground,geometry,
    operational_status,confidence,metadata,last_seen_at)
  select target.source_id,target.source_artifact_id,p_release_id,s.source_record_id,s.name,
    s.operator_name,array(select jsonb_array_elements_text(s.voltage_kv)::numeric),
    coalesce(s.metadata->>'power','')='cable',
    extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326))::extensions.geometry(MultiLineString,4326),
    s.operational_status,'medium',s.metadata,now()
  from public.grid_osm_release_staging s where s.release_id=p_release_id and s.kind='line'
  on conflict(source_id,source_record_id) do update set
    source_artifact_id=excluded.source_artifact_id,dataset_release_id=excluded.dataset_release_id,
    name=excluded.name,operator_name=excluded.operator_name,voltage_kv=excluded.voltage_kv,
    underground=excluded.underground,geometry=excluded.geometry,
    operational_status=excluded.operational_status,metadata=excluded.metadata,last_seen_at=now();

  insert into public.canonical_industrial_sites(source_id,source_artifact_id,dataset_release_id,
    source_record_id,name,site_kind,geometry,area_ha,planning_status,metadata,last_seen_at)
  select target.source_id,target.source_artifact_id,p_release_id,s.source_record_id,s.name,
    'industrial_land',
    extensions.st_multi(extensions.st_makevalid(extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326)))::extensions.geometry(MultiPolygon,4326),
    extensions.st_area(extensions.st_transform(extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326),3035))/10000,
    'screening_only',s.metadata,now()
  from public.grid_osm_release_staging s where s.release_id=p_release_id and s.kind='industrial_site'
  on conflict(source_id,source_record_id) do update set
    source_artifact_id=excluded.source_artifact_id,dataset_release_id=excluded.dataset_release_id,
    name=excluded.name,geometry=excluded.geometry,area_ha=excluded.area_ha,
    metadata=excluded.metadata,last_seen_at=now();

  delete from public.canonical_grid_nodes n where n.source_id=target.source_id
    and n.dataset_release_id is distinct from p_release_id;
  delete from public.canonical_grid_lines l where l.source_id=target.source_id
    and l.dataset_release_id is distinct from p_release_id;
  delete from public.canonical_industrial_sites i where i.source_id=target.source_id
    and i.dataset_release_id is distinct from p_release_id;
  update public.grid_dataset_releases set status='superseded',superseded_at=now()
    where source_id=target.source_id and status='active' and id<>p_release_id;
  update public.grid_dataset_releases set status='active',activated_at=now() where id=p_release_id;
  update public.grid_source_artifacts set status='superseded'
    where source_id=target.source_id and status='active' and id<>target.source_artifact_id;
  update public.grid_source_artifacts set status='active' where id=target.source_artifact_id;
  update public.grid_ingestion_runs set status='published',finished_at=now()
    where id=target.ingestion_run_id;
  delete from public.grid_osm_release_staging where release_id=p_release_id;
  return jsonb_build_object('release_id',p_release_id,'record_count',staged_count,
    'counts',jsonb_build_object('node',node_count,'line',line_count,'industrial_site',site_count));
end;
$$;
revoke all on function public.promote_osm_grid_release(uuid) from public,anon,authenticated;
grant execute on function public.promote_osm_grid_release(uuid) to service_role;
