create or replace function public.power_finder_public_candidate_nodes(
  west double precision, south double precision, east double precision, north double precision,
  max_features integer default 1000
)
returns jsonb language sql stable security definer set search_path = '' set statement_timeout = '8s'
as $$
  with bounds as (select extensions.st_makeenvelope(west,south,east,north,4326) geometry),
  nodes as (
    select n.source_record_id feature_id,n.canonical_name name,
      coalesce(o.canonical_name,n.operator_name) operator,n.voltage_kv,n.operational_status status,
      n.geometry,s.evidence_class,s.source_url,
      coalesce(c.observation_type,'not_established') capacity_state,c.exact_mw,c.band_min_mw,
      c.band_max_mw,c.confidence_grade,c.published_at capacity_published_at
    from public.canonical_grid_nodes n join public.grid_sources s on s.id=n.source_id
    join bounds b on extensions.st_intersects(n.geometry,b.geometry)
    left join public.grid_operators o on o.id=n.operator_id
    left join lateral (
      select x.* from public.public_capacity_observations x
      where x.node_id=n.id and x.direction='demand'
      order by x.published_at desc nulls last,x.created_at desc limit 1
    ) c on true
    where n.source_artifact_id is null or exists (
      select 1 from public.grid_source_artifacts a where a.id=n.source_artifact_id and a.status='active')
    order by n.source_record_id limit least(greatest(coalesce(max_features,1000),1),1000)
  ) select jsonb_build_object(
    'type','FeatureCollection','metadata',jsonb_build_object(
      'title','GridPulse candidate-node screening context','source_id','candidate-nodes-public-v1',
      'publisher','Attributed per feature','licence','See source register and feature attribution',
      'attribution','OpenStreetMap contributors; accepted operator/public sources where attributed',
      'published_at',now(),'geographic_scope',jsonb_build_array(west,south,east,north),
      'freshness','queried from active accepted source releases','artifact_sha256','database-query-candidate-nodes-v1',
      'record_count',(select count(*) from nodes),'available_kinds',jsonb_build_array('node'),
      'kind_counts',jsonb_build_object('node',(select count(*) from nodes)),
      'evidence_boundary','Mapped nodes support screening only. Available capacity requires operator evidence.'),
    'features',coalesce((select jsonb_agg(jsonb_build_object(
      'type','Feature','id',feature_id,'geometry',extensions.st_asgeojson(geometry)::jsonb,
      'properties',jsonb_strip_nulls(jsonb_build_object('kind','node','name',name,'operator',operator,
        'voltage_kv',to_jsonb(voltage_kv),'status',status,'evidence_class',evidence_class,
        'capacity_state',capacity_state,'exact_mw',exact_mw,'band_min_mw',band_min_mw,
        'band_max_mw',band_max_mw,'confidence_grade',confidence_grade,
        'capacity_published_at',capacity_published_at,'source_url',source_url)))) from nodes),'[]'::jsonb))
$$;
revoke all on function public.power_finder_public_candidate_nodes(double precision,double precision,double precision,double precision,integer) from public,anon,authenticated;
grant execute on function public.power_finder_public_candidate_nodes(double precision,double precision,double precision,double precision,integer) to anon,authenticated;
