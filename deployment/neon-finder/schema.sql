-- Dedicated public projection on Neon only. Never apply this file to Supabase.
create extension if not exists postgis;
create schema if not exists finder_public;
revoke all on schema finder_public from public;

create table if not exists finder_public.snapshots (
  id text primary key,
  metadata jsonb not null,
  coverage jsonb not null,
  extras jsonb not null default '{}',
  expected_counts jsonb not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  manifest_sha256 text
);
create table if not exists finder_public.active_snapshot (
  singleton boolean primary key default true check (singleton),
  snapshot_id text not null references finder_public.snapshots(id)
);
create table if not exists finder_public.features (
  snapshot_id text not null references finder_public.snapshots(id),
  kind text not null check (kind in ('node','line','industrial_site','generation_asset','storage_asset')),
  id text not null,
  source_release_id text not null,
  properties jsonb not null check (jsonb_typeof(properties) = 'object' and properties->>'kind' = kind),
  geometry public.geometry(Geometry,4326) not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  primary key(snapshot_id,kind,id)
);
create index if not exists finder_features_geometry_idx on finder_public.features using gist(geometry);
create table if not exists finder_public.batches (
  snapshot_id text not null references finder_public.snapshots(id),
  batch_id text not null,
  records integer not null,
  payload_sha256 text not null,
  primary key(snapshot_id,batch_id)
);
revoke all on all tables in schema finder_public from public;

create or replace function finder_public.record_hash(i text,k text,r text,p text,g text)
returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_array(i,k,r,p,g)::text,'UTF8')),'hex')
$$;

create or replace function finder_public.import_batch(s text,b text,payload jsonb)
returns integer language plpgsql set search_path='' as $$
declare n integer; h text; previous text;
begin
 if exists(select 1 from finder_public.snapshots where id=s and activated_at is not null) then
   raise exception 'An activated snapshot is immutable';
 end if;
 if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)>5000 then
   raise exception 'Invalid or oversized batch';
 end if;
 h:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
 select payload_sha256 into previous from finder_public.batches where snapshot_id=s and batch_id=b;
 if previous is not null then
   if previous<>h then raise exception 'Batch identity changed'; end if;
   return 0;
 end if;
 if exists(select 1 from jsonb_to_recordset(payload) as x(id text,kind text,source_release_id text,properties_text text,geometry_hex text,row_sha256 text)
   where x.row_sha256 is distinct from finder_public.record_hash(x.id,x.kind,x.source_release_id,x.properties_text,x.geometry_hex)
      or x.id is null or x.source_release_id is null
      or x.source_release_id not in ('40daf143-2b0b-4f7b-933d-0efc48ca4649','94ce31d6-3b18-4d81-a301-8503f77b586c')) then
   raise exception 'Row hash or admitted release mismatch';
 end if;
 insert into finder_public.features(snapshot_id,kind,id,source_release_id,properties,geometry,source_hash)
 select s,x.kind,x.id,x.source_release_id,x.properties_text::jsonb,
   public.st_geomfromewkb(decode(x.geometry_hex,'hex')),x.row_sha256
 from jsonb_to_recordset(payload) as x(id text,kind text,source_release_id text,properties_text text,geometry_hex text,row_sha256 text);
 get diagnostics n=row_count;
 insert into finder_public.batches values(s,b,n,h);
 return n;
end $$;

create or replace function finder_public.activate(s text,manifest text)
returns jsonb language plpgsql set search_path='' as $$
declare counts jsonb; expected jsonb; n bigint;
begin
 select expected_counts into expected from finder_public.snapshots where id=s;
 if expected is null then raise exception 'Unknown snapshot'; end if;
 select jsonb_object_agg(kind,c) into counts from
   (select kind,count(*) c from finder_public.features where snapshot_id=s group by kind) t;
 if counts is distinct from expected then raise exception 'Snapshot counts do not match admission manifest'; end if;
 if (select count(*) from finder_public.operational_status where snapshot_id=s)<>23445
 or (select extras->>'status_sha256' from finder_public.snapshots where id=s) is distinct from
   '328d56b361ee88b7abd055b4332009c4369bc18c049b2f0eb01a2a19ba4fa9d5'
 then raise exception 'Operational status supplement is incomplete'; end if;
 if exists(select 1 from finder_public.features where snapshot_id=s and
   (not public.st_isvalid(geometry) or public.st_isempty(geometry) or public.st_srid(geometry)<>4326))
 then raise exception 'Invalid or empty source geometry requires review'; end if;
 if (select count(distinct zoom_level) from finder_public.registry_overview where snapshot_id=s)<>4
 or exists(select 1 from finder_public.registry_overview where snapshot_id=s group by zoom_level
   having sum((properties->>'asset_count')::bigint)<>(expected->>'generation_asset')::bigint+(expected->>'storage_asset')::bigint)
 then raise exception 'Registry overview counts differ'; end if;
 if exists(select 1 from finder_public.features f where snapshot_id=s and
   f.source_hash is distinct from finder_public.record_hash(f.id,f.kind,f.source_release_id,f.properties::text,encode(public.st_asewkb(f.geometry),'hex'))) then
   raise exception 'Restored geometry or property hash mismatch';
 end if;
 if pg_database_size(current_database())>734003200 then raise exception 'Free-tier safety budget exceeded'; end if;
 if manifest !~ '^[0-9a-f]{64}$' then raise exception 'Manifest SHA-256 required'; end if;
 select count(*) into n from finder_public.features where snapshot_id=s;
 if n<>(select sum(records) from finder_public.batches where snapshot_id=s) then raise exception 'Batch counts differ'; end if;
 update finder_public.snapshots set activated_at=coalesce(activated_at,now()),manifest_sha256=manifest where id=s;
 insert into finder_public.active_snapshot values(true,s) on conflict(singleton) do update set snapshot_id=excluded.snapshot_id;
 return jsonb_build_object('snapshot',s,'counts',counts,'records',n,'database_bytes',pg_database_size(current_database()));
end $$;

create or replace function finder_public.viewport(w double precision,s double precision,e double precision,n double precision,g boolean,t boolean,nodes_only boolean)
-- Fixed bounded SELECT only. Definer execution permits the GiST index behind RLS.
returns jsonb language plpgsql stable security definer set search_path='' set jit=off as $$
declare result jsonb;
begin
 if w is null or s is null or e is null or n is null or w>=e or s>=n or w<5.8 or e>15.1 or s<47.2 or n>55.2 or (e-w)*(n-s)>6 then
   raise exception 'Invalid German viewport' using errcode='22023';
 end if;
 with selected as (
   select f.kind,f.id,f.geometry,f.properties||jsonb_build_object('status',
     coalesce(os.status,case when f.kind='industrial_site' then 'unknown' else 'operational' end)) properties
   from finder_public.features f join finder_public.active_snapshot a on a.snapshot_id=f.snapshot_id
   left join finder_public.operational_status os on os.snapshot_id=f.snapshot_id and os.kind=f.kind and os.id=f.id
   where public.st_intersects(f.geometry,public.st_makeenvelope(w,s,e,n,4326))
     and (not nodes_only or f.kind='node')
     and (f.kind<>'generation_asset' or g) and (f.kind<>'storage_asset' or t)
   order by case f.kind when 'node' then 1 when 'line' then 2 when 'industrial_site' then 3 when 'storage_asset' then 4 else 5 end,f.id
   limit case when nodes_only then 1000 else 2500 end
 ), features as (
   select jsonb_build_object('type','Feature','id',id,'geometry',public.st_asgeojson(geometry)::jsonb,'properties',properties) feature,kind from selected
 ), counts as (select kind,count(*) c from features group by kind)
 select jsonb_build_object('type','FeatureCollection','metadata',
   snap.metadata||jsonb_build_object('dataset_release',snap.id,'artifact_sha256',snap.manifest_sha256,
    'record_count',(select count(*) from features),'geographic_scope',jsonb_build_array(w,s,e,n),
    'available_kinds',case when nodes_only then jsonb_build_array('node')
      else jsonb_build_array('node','line','industrial_site','generation_asset','storage_asset') end,
    'returned_kinds',coalesce((select jsonb_agg(kind order by kind) from counts),'[]'),
    'kind_counts',coalesce((select jsonb_object_agg(kind,c) from counts),'{}'),
    'coverage_status','accepted_partial','retrieval_capped',(select count(*) from features)>=case when nodes_only then 1000 else 2500 end),
   'features',coalesce((select jsonb_agg(feature) from features),'[]')) into result
 from finder_public.snapshots snap join finder_public.active_snapshot a on a.snapshot_id=snap.id;
 if result is null then raise exception 'No qualified snapshot is active'; end if;
 return result;
end $$;

create or replace function finder_public.coverage()
returns jsonb language sql stable set search_path='' as $$
 select coalesce((select s.coverage||jsonb_build_object('projection_snapshot',s.id,'projection_sha256',s.manifest_sha256)
 from finder_public.snapshots s join finder_public.active_snapshot a on a.snapshot_id=s.id),
 jsonb_build_object('coverage_status','unavailable','releases','[]'::jsonb))
$$;
create or replace function finder_public.operators()
returns jsonb language sql stable set search_path='' as $$
 select coalesce((select s.extras->'operators' from finder_public.snapshots s join finder_public.active_snapshot a on a.snapshot_id=s.id),'[]')
$$;
create or replace function finder_public.study(node_id text)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(s.extras->'studies'->coalesce(node_id,'') ,s.extras->'default_study')
 from finder_public.snapshots s join finder_public.active_snapshot a on a.snapshot_id=s.id
$$;

create or replace function finder_public.tile(z integer,x integer,y integer,registry boolean,g boolean,t boolean)
-- No dynamic SQL; active snapshot only; raw feature tables are not granted to the app.
returns bytea language plpgsql stable security definer set search_path='' set jit=off as $$
declare tile bytea;
begin
 if z<4 or z>16 or x<0 or y<0 or x>=(1<<z) or y>=(1<<z) then raise exception 'Invalid tile'; end if;
 with bounds as (select public.st_tileenvelope(z,x,y) mercator,
   public.st_transform(public.st_tileenvelope(z,x,y),4326) geographic),
 eligible as (
   select f.kind,f.id,f.geometry,f.properties||jsonb_build_object('status',
     coalesce(os.status,case when f.kind='industrial_site' then 'unknown' else 'operational' end)) properties,
     coalesce((f.properties->>'max_voltage_kv')::double precision,0) kv
   from finder_public.features f join finder_public.active_snapshot a on a.snapshot_id=f.snapshot_id cross join bounds b
   left join finder_public.operational_status os on os.snapshot_id=f.snapshot_id and os.kind=f.kind and os.id=f.id
   where f.geometry operator(public.&&) b.geographic and public.st_intersects(f.geometry,b.geographic)
     and (case when registry then f.kind in ('generation_asset','storage_asset')
       else f.kind in ('node','line','industrial_site') end)
     and (f.kind<>'generation_asset' or g) and (f.kind<>'storage_asset' or t)
     and (registry or (case when f.kind='industrial_site' then z>=7
       else z>=9 or (z>=8 and coalesce((f.properties->>'max_voltage_kv')::double precision,0)>=110)
       or (z>=7 and coalesce((f.properties->>'max_voltage_kv')::double precision,0)>=220)
       or coalesce((f.properties->>'max_voltage_kv')::double precision,0)>=380 end))
 ), grid as (
   select id,kind,properties,
     public.st_transform(case when kind='industrial_site' and z<10 then public.st_centroid(geometry) else geometry end,3857) geom
   from eligible where not registry and
     (case when kind='industrial_site' then z>=7 else z>=9 or (z>=8 and kv>=110) or (z>=7 and kv>=220) or kv>=380 end)
 ), registry_cells as (
   select *,public.st_snaptogrid(public.st_transform(geometry,3857),case z
     when 4 then 192000 when 5 then 96000 when 6 then 48000 when 7 then 24000
     when 8 then 12000 when 9 then 6000 when 10 then 3000 when 11 then 1500 when 12 then 750 else 375 end) cell
   from eligible where registry and z between 8 and 13
 ), aggregates as (
   select md5(concat(z,kind,properties->>'generation_group',public.st_astext(cell))) id,kind,
     jsonb_build_object('name',concat(count(*),' registered assets'),'status','aggregate',
       'generation_group',properties->>'generation_group','asset_count',count(*),
       'known_mw_count',count(properties->>'net_capacity_mw'),
       'net_capacity_mw',sum((properties->>'net_capacity_mw')::double precision),
       'registered_mw',sum((properties->>'net_capacity_mw')::double precision),
       'storage_energy_mwh',sum((properties->>'storage_energy_mwh')::double precision)) properties,
     public.st_centroid(public.st_collect(public.st_transform(geometry,3857))) geom
   from registry_cells group by kind,properties->>'generation_group',cell
 ), exact as (
   select id,kind,properties||jsonb_build_object('asset_count',1,'known_mw_count',case when properties?'net_capacity_mw' then 1 else 0 end,
     'registered_mw',properties->'net_capacity_mw') properties,public.st_transform(geometry,3857) geom
   from eligible where registry and z>=14
 ), overview as (
   select o.id,o.kind,o.properties,o.geometry geom
   from finder_public.registry_overview o join finder_public.active_snapshot a on a.snapshot_id=o.snapshot_id
   cross join bounds b where registry and z<8 and o.zoom_level=z and o.geometry operator(public.&&) b.mercator
     and (o.kind<>'generation_asset' or g) and (o.kind<>'storage_asset' or t)
 ), display as (select * from grid union all select * from aggregates union all select * from exact union all select * from overview),
 limited as (
   select * from display order by case kind when 'node' then 1 when 'line' then 2 when 'industrial_site' then 3 else 4 end,
     (properties->>'net_capacity_mw')::double precision desc nulls last,id limit 20000
 ), mvt as (
   select d.id,d.kind,d.properties->>'name' name,d.properties->>'operator' operator,d.properties->>'status' status,
     d.properties->>'voltage_kv' voltage_kv,(d.properties->>'max_voltage_kv')::double precision max_voltage_kv,
     d.properties->>'capacity_state' capacity_state,d.properties->>'source_url' source_url,
     d.properties->>'technology' technology,d.properties->>'generation_group' generation_group,
     (d.properties->>'net_capacity_mw')::double precision net_capacity_mw,
     (d.properties->>'registered_mw')::double precision registered_mw,
     (d.properties->>'storage_energy_mwh')::double precision storage_energy_mwh,
     (d.properties->>'asset_count')::integer asset_count,(d.properties->>'known_mw_count')::integer known_mw_count,
     public.st_asmvtgeom(case when kind='line' then public.st_simplifypreservetopology(d.geom,
       case when z<7 then 500 when z<10 then 80 else 5 end) else d.geom end,b.mercator,4096,64,true) geom
   from limited d cross join bounds b
 ) select coalesce(public.st_asmvt(mvt,'power_finder',4096,'geom'),'') into tile from mvt where geom is not null;
 return tile;
end $$;

-- Reader role is created separately with a generated credential. These grants
-- are applied only after load/qualification; no anonymous or owner credential is published.
revoke all on all functions in schema finder_public from public;
