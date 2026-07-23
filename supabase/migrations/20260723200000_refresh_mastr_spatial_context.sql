-- Run the first full MaStR context refresh through the migration connection,
-- which is intended for bounded batch work rather than the short PostgREST timeout.

select public.refresh_power_finder_spatial_metrics();
