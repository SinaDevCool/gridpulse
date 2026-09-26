-- PostGIS MVT encodes arbitrary-precision numeric values as strings. Cast the
-- styling field to float8 so MapLibre receives a native number.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(definition,
    'COALESCE(( SELECT max(v.v) AS max FROM unnest(c.voltage_kv) v(v)), (0)::numeric) AS max_voltage_kv',
    'COALESCE(( SELECT max(v.v) AS max FROM unnest(c.voltage_kv) v(v)), (0)::numeric)::double precision AS max_voltage_kv');
  if updated = definition then
    updated := replace(definition,
      'coalesce((select max(v) from unnest(c.voltage_kv) v), 0) max_voltage_kv',
      'coalesce((select max(v) from unnest(c.voltage_kv) v), 0)::double precision max_voltage_kv');
  end if;
  if updated = definition then raise exception 'tile numeric max-voltage encoding failed'; end if;
  execute updated;
end;
$$;
