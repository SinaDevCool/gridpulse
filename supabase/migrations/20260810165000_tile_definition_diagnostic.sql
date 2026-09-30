create or replace function public.gridpulse_tile_definition_diagnostic()
returns text language sql security definer set search_path = '' as $$
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  );
$$;
revoke all on function public.gridpulse_tile_definition_diagnostic() from public,anon,authenticated;
grant execute on function public.gridpulse_tile_definition_diagnostic() to service_role;
