-- Defense in depth: public Finder callers execute the allowlisted function but
-- cannot query its canonical source tables through PostgREST.

revoke all on table public.grid_sources from anon;
revoke all on table public.grid_source_artifacts from anon;
revoke all on table public.canonical_grid_nodes from anon;
revoke all on table public.canonical_grid_lines from anon;
revoke all on table public.canonical_industrial_sites from anon;
revoke all on table public.canonical_energy_assets from anon;
revoke all on table public.grid_operators from anon;
revoke all on table public.public_capacity_observations from anon;

grant execute on function public.power_finder_public_viewport(
  double precision, double precision, double precision, double precision,
  boolean, boolean, integer
) to anon, authenticated;
