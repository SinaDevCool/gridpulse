create or replace function public.materialize_osm_grid_release(
  p_release_id uuid, p_kind text, p_after_id text default '', p_limit integer default 5000
)
returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '45s'
as $$
declare target public.grid_dataset_releases; processed integer; last_id text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if p_kind not in ('node','line','industrial_site') or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid materialization batch';
  end if;
  select * into target from public.grid_dataset_releases where id=p_release_id;
  if target.id is null or target.status <> 'validating'
     or coalesce((target.validation_report->>'valid')::boolean,false) is not true then
    raise exception 'accepted validating release required';
  end if;

  if p_kind='node' then
    insert into public.canonical_grid_nodes(source_id,source_artifact_id,dataset_release_id,
      source_record_id,canonical_name,node_type,operator_name,voltage_kv,geometry,
      operational_status,location_precision,confidence,metadata,last_seen_at)
    select target.source_id,target.source_artifact_id,p_release_id,s.source_record_id,
      coalesce(s.name,'Mapped substation'),'substation',s.operator_name,
      array(select jsonb_array_elements_text(s.voltage_kv)::numeric),
      extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326)::extensions.geometry(Point,4326),
      s.operational_status,'mapped','medium',s.metadata,now()
    from public.grid_osm_release_staging s where s.release_id=p_release_id and s.kind=p_kind
      and s.source_record_id>p_after_id order by s.source_record_id limit p_limit
    on conflict(source_id,source_record_id) do update set
      source_artifact_id=excluded.source_artifact_id,dataset_release_id=excluded.dataset_release_id,
      canonical_name=excluded.canonical_name,operator_name=excluded.operator_name,
      voltage_kv=excluded.voltage_kv,geometry=excluded.geometry,
      operational_status=excluded.operational_status,metadata=excluded.metadata,last_seen_at=now();
  elsif p_kind='line' then
    insert into public.canonical_grid_lines(source_id,source_artifact_id,dataset_release_id,
      source_record_id,name,operator_name,voltage_kv,underground,geometry,
      operational_status,confidence,metadata,last_seen_at)
    select target.source_id,target.source_artifact_id,p_release_id,s.source_record_id,s.name,
      s.operator_name,array(select jsonb_array_elements_text(s.voltage_kv)::numeric),
      coalesce(s.metadata->>'power','')='cable',
      extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326))::extensions.geometry(MultiLineString,4326),
      s.operational_status,'medium',s.metadata,now()
    from public.grid_osm_release_staging s where s.release_id=p_release_id and s.kind=p_kind
      and s.source_record_id>p_after_id order by s.source_record_id limit p_limit
    on conflict(source_id,source_record_id) do update set
      source_artifact_id=excluded.source_artifact_id,dataset_release_id=excluded.dataset_release_id,
      name=excluded.name,operator_name=excluded.operator_name,voltage_kv=excluded.voltage_kv,
      underground=excluded.underground,geometry=excluded.geometry,
      operational_status=excluded.operational_status,metadata=excluded.metadata,last_seen_at=now();
  else
    insert into public.canonical_industrial_sites(source_id,source_artifact_id,dataset_release_id,
      source_record_id,name,site_kind,geometry,area_ha,planning_status,metadata,last_seen_at)
    select target.source_id,target.source_artifact_id,p_release_id,s.source_record_id,s.name,
      'industrial_land',
      extensions.st_multi(extensions.st_makevalid(extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326)))::extensions.geometry(MultiPolygon,4326),
      extensions.st_area(extensions.st_transform(extensions.st_setsrid(extensions.st_geomfromgeojson(s.geometry),4326),3035))/10000,
      'screening_only',s.metadata,now()
    from public.grid_osm_release_staging s where s.release_id=p_release_id and s.kind=p_kind
      and s.source_record_id>p_after_id order by s.source_record_id limit p_limit
    on conflict(source_id,source_record_id) do update set
      source_artifact_id=excluded.source_artifact_id,dataset_release_id=excluded.dataset_release_id,
      name=excluded.name,geometry=excluded.geometry,area_ha=excluded.area_ha,
      metadata=excluded.metadata,last_seen_at=now();
  end if;
  get diagnostics processed = row_count;
  select max(source_record_id) into last_id from (
    select source_record_id from public.grid_osm_release_staging
    where release_id=p_release_id and kind=p_kind and source_record_id>p_after_id
    order by source_record_id limit p_limit
  ) q;
  return jsonb_build_object('processed',processed,'last_id',last_id,'done',processed<p_limit);
end;
$$;

create or replace function public.activate_materialized_osm_grid_release(p_release_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '45s'
as $$
declare target public.grid_dataset_releases; staged bigint; materialized bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select * into target from public.grid_dataset_releases where id=p_release_id for update;
  if target.id is null or target.status <> 'validating' then raise exception 'validating release required'; end if;
  select count(*) into staged from public.grid_osm_release_staging where release_id=p_release_id;
  select (select count(*) from public.canonical_grid_nodes where dataset_release_id=p_release_id)
       + (select count(*) from public.canonical_grid_lines where dataset_release_id=p_release_id)
       + (select count(*) from public.canonical_industrial_sites where dataset_release_id=p_release_id)
    into materialized;
  if staged<>target.record_count or materialized<>target.record_count then
    raise exception 'release incomplete: staged %, materialized %, expected %',staged,materialized,target.record_count;
  end if;
  update public.grid_dataset_releases set status='superseded',superseded_at=now()
    where source_id=target.source_id and status='active' and id<>p_release_id;
  update public.grid_dataset_releases set status='active',activated_at=now() where id=p_release_id;
  update public.grid_source_artifacts set status='superseded'
    where (source_id=target.source_id and status='active' and id<>target.source_artifact_id)
       or (source_id='openstreetmap-germany-overpass-v1' and status='active');
  update public.grid_source_artifacts set status='active' where id=target.source_artifact_id;
  update public.grid_ingestion_runs set status='published',finished_at=now(),error_summary=null
    where id=target.ingestion_run_id;
  return jsonb_build_object('release_id',p_release_id,'record_count',materialized);
end;
$$;

revoke all on function public.materialize_osm_grid_release(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.activate_materialized_osm_grid_release(uuid) from public,anon,authenticated;
grant execute on function public.materialize_osm_grid_release(uuid,text,text,integer) to service_role;
grant execute on function public.activate_materialized_osm_grid_release(uuid) to service_role;
