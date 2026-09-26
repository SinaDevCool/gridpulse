create or replace function public.grid_max_voltage(voltage_values numeric[])
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(max(value), 0) from unnest(voltage_values) value
$$;

revoke all on function public.grid_max_voltage(numeric[]) from public, anon, authenticated;

create index if not exists canonical_grid_nodes_max_voltage_idx
  on public.canonical_grid_nodes (public.grid_max_voltage(voltage_kv));
create index if not exists canonical_grid_lines_max_voltage_idx
  on public.canonical_grid_lines (public.grid_max_voltage(voltage_kv));

do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := replace(definition,
    '(z >= 9 OR (z >= 8 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 110)) OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 220)) OR EXISTS (SELECT 1 FROM unnest(n.voltage_kv) v WHERE v >= 380))',
    '(z >= 9 OR (z >= 8 AND public.grid_max_voltage(n.voltage_kv) >= 110) OR (z >= 7 AND public.grid_max_voltage(n.voltage_kv) >= 220) OR public.grid_max_voltage(n.voltage_kv) >= 380)');
  updated := replace(updated,
    '(z >= 9 OR (z >= 8 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 110)) OR (z >= 7 AND EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 220)) OR EXISTS (SELECT 1 FROM unnest(l.voltage_kv) v WHERE v >= 380))',
    '(z >= 9 OR (z >= 8 AND public.grid_max_voltage(l.voltage_kv) >= 110) OR (z >= 7 AND public.grid_max_voltage(l.voltage_kv) >= 220) OR public.grid_max_voltage(l.voltage_kv) >= 380)');
  if updated = definition then raise exception 'indexed voltage-tier replacement failed'; end if;
  execute updated;
end;
$$;

analyze public.canonical_grid_nodes;
analyze public.canonical_grid_lines;
