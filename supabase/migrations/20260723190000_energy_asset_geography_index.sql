-- Distance calculations cast points to geography. Match that expression so
-- ST_DWithin can use GiST rather than scanning every registered asset.

create index canonical_energy_assets_geography_idx
  on public.canonical_energy_assets
  using gist ((geometry::extensions.geography))
  where geometry is not null;

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
    E'begin\n  delete from public.grid_node_asset_context',
    E'begin\n  perform set_config(''statement_timeout'', ''120000'', true);\n\n  delete from public.grid_node_asset_context'
  );

  if updated_definition = definition then
    raise exception 'spatial metric refresh definition did not match expected function body';
  end if;

  execute updated_definition;
end;
$$;
