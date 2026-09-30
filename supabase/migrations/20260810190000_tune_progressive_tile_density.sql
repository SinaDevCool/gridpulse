do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(definition,
    ' OR (z = 6 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 220))', '');
  updated := replace(updated,
    ' OR (z = 6 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 220))', '');
  updated := replace(updated,
    'join tile_bounds b on z >= 7 and extensions.st_intersects(extensions.st_transform(i.geometry,3857), b.geom)',
    'join tile_bounds b on z >= 8 and extensions.st_intersects(extensions.st_transform(i.geometry,3857), b.geom)');
  if updated = definition then raise exception 'tile density tuning failed'; end if;
  execute updated;
end;
$$;
