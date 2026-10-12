-- National OSM promotion performs PostGIS conversion and indexed upserts for
-- roughly 300k staged records in one atomic transaction. Give this governed,
-- service-role-only operation enough time while keeping ordinary API limits.
alter function public.promote_osm_grid_release(uuid)
  set statement_timeout = '110s';
