-- The enrichment RPC calculates percentage values from PostGIS double
-- precision areas. PostgreSQL only provides the two-argument round overload
-- for numeric values, so provide an internal, fixed-path bridge overload.
create or replace function public.round(p_value double precision, p_scale integer)
returns numeric
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select pg_catalog.round(p_value::numeric, p_scale)
$$;

revoke all on function public.round(double precision, integer) from public, anon, authenticated;

