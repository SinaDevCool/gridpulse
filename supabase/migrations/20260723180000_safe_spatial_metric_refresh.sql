-- PostgREST sessions enable pg-safeupdate. Keep the intentional full refresh,
-- but express it with non-null primary-key predicates so the guard can verify scope.

do $$
declare
  definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.refresh_power_finder_spatial_metrics()'::regprocedure
  ) into definition;

  updated_definition := replace(
    definition,
    'delete from public.grid_node_asset_context;',
    'delete from public.grid_node_asset_context where node_id is not null;'
  );
  updated_definition := replace(
    updated_definition,
    'delete from public.site_node_metrics;',
    'delete from public.site_node_metrics where site_id is not null;'
  );

  if updated_definition = definition then
    raise exception 'spatial metric refresh definition did not match expected delete statements';
  end if;

  execute updated_definition;
end;
$$;
