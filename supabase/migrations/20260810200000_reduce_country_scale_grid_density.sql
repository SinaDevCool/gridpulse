-- Keep the country view readable and small: 380 kV at z4-6, 220 kV at z7,
-- 110 kV at z8, then the complete accepted topology from z9 onward.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(definition,
    '(z >= 9 OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 110)) OR EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 380))',
    '(z >= 9 OR (z >= 8 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 110)) OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 220)) OR EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 380))');
  updated := replace(updated,
    '(z >= 9 OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 110)) OR EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 380))',
    '(z >= 9 OR (z >= 8 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 110)) OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 220)) OR EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 380))');
  if updated = definition then raise exception 'country-scale density tuning failed'; end if;
  execute updated;
end;
$$;
