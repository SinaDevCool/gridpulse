-- The public MVT function intersects in Web Mercator. Expression indexes let
-- PostGIS use a spatial index instead of transforming every national feature.
create index if not exists canonical_grid_nodes_geometry_3857_gist_idx
  on public.canonical_grid_nodes using gist (extensions.st_transform(geometry, 3857));
create index if not exists canonical_grid_lines_geometry_3857_gist_idx
  on public.canonical_grid_lines using gist (extensions.st_transform(geometry, 3857));
create index if not exists canonical_industrial_sites_geometry_3857_gist_idx
  on public.canonical_industrial_sites using gist (extensions.st_transform(geometry, 3857));

-- Country overview tiles intentionally show transmission infrastructure;
-- distribution detail enters from zoom 7 onward.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(
    definition,
    'where (l.source_artifact_id is null or exists (',
    'where (z >= 7 or coalesce(l.voltage_kv[1], 0) >= 110) and (l.source_artifact_id is null or exists ('
  );
  if updated = definition then raise exception 'tile line filter insertion failed'; end if;
  execute updated;
end;
$$;
