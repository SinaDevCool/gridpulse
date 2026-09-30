-- Publish one numeric styling value alongside the complete voltage array. This
-- avoids parsing the MVT text representation in every browser paint expression.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(definition,
    'select id, kind, name, operator, status, voltage_kv::text, capacity_state, source_url,',
    'select id, kind, name, operator, status, voltage_kv::text, coalesce((select max(v) from unnest(c.voltage_kv) v), 0) max_voltage_kv, capacity_state, source_url,');
  if updated = definition then raise exception 'tile max-voltage publication failed'; end if;
  execute updated;
end;
$$;
