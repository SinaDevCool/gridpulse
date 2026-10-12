-- Vector tiles are used below zoom 8, so keep their node content to the
-- transmission-grid overview instead of returning every distribution node.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(definition,
    '(z >= 7 OR COALESCE(n.voltage_kv[1], (0)::numeric) >= (110)::numeric)',
    '(z >= 9 OR COALESCE(n.voltage_kv[1], (0)::numeric) >= (110)::numeric)');
  if updated = definition then
    updated := replace(definition,
      '(z >= 7 or coalesce(n.voltage_kv[1], 0) >= 110)',
      '(z >= 9 or coalesce(n.voltage_kv[1], 0) >= 110)');
  end if;
  if updated = definition then raise exception 'tile node threshold update failed'; end if;
  execute updated;
end;
$$;
