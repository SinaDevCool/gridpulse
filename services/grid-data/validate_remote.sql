select jsonb_build_object(
  'nodes', (select count(*) from public.canonical_grid_nodes),
  'lines', (select count(*) from public.canonical_grid_lines),
  'industrial_sites', (select count(*) from public.canonical_industrial_sites),
  'active_artifacts',
    (select count(*) from public.grid_source_artifacts where status = 'active'),
  'function_security',
    (
      select security_type
      from information_schema.routines
      where routine_schema = 'public' and routine_name = 'power_finder_viewport'
    ),
  'execute_grantees',
    (
      select jsonb_agg(distinct grantee order by grantee)
      from information_schema.routine_privileges
      where specific_schema = 'public'
        and routine_name = 'power_finder_viewport'
        and privilege_type = 'EXECUTE'
    ),
  'viewport_features',
    (
      select jsonb_array_length(
        public.power_finder_viewport(13.15, 52.22, 13.55, 52.40, 2500) -> 'features'
      )
    ),
  'energy_assets', (select count(*) from public.canonical_energy_assets),
  'site_node_metrics', (select count(*) from public.site_node_metrics),
  'node_asset_context_rows', (select count(*) from public.grid_node_asset_context),
  'shortlists', (select count(*) from public.power_finder_shortlists),
  'ranked_candidates',
    (
      select jsonb_array_length(
        public.power_finder_ranked_candidates(100, 20, 25) -> 'candidates'
      )
    )
) as validation;
