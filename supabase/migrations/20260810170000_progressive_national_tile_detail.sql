-- Country-scale tiles contain only transmission detail. Distribution detail
-- enters progressively as the user zooms, reducing tile bytes and visual load.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(definition,
    '(z >= 9 or coalesce(n.voltage_kv[1], 0) >= 110)',
    '(z >= 9 OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 110)) OR (z = 6 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 220)) OR EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 380))');
  updated := replace(updated,
    '(z >= 7 or coalesce(l.voltage_kv[1], 0) >= 110)',
    '(z >= 9 OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 110)) OR (z = 6 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 220)) OR EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 380))');
  updated := replace(updated,
    'extensions.st_transform(i.geometry,3857)',
    'extensions.st_transform(CASE WHEN z < 10 THEN extensions.st_centroid(i.geometry) ELSE i.geometry END, 3857)');
  if updated = definition then raise exception 'progressive tile update failed'; end if;
  execute updated;
end;
$$;
