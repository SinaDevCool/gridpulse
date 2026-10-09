-- Historical SMARD forecast series do not expose immutable publication vintages.
-- Keep load forecast optional until GridPulse captures issued_at prospectively.
update public.grid_context_metrics
set mandatory=false
where metric_key='load_forecast_mw';

comment on column public.grid_context_observations.issued_at is
  'Required for a forecast value to enter a point-in-time feature snapshot. Null historical forecast vintages remain stored but are excluded.';

alter table public.grid_context_observations
  add constraint grid_context_observations_source_record_unique
  unique(source_key,source_record_id);
