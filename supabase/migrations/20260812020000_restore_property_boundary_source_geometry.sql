-- Preserve the source GeoJSON used to derive the normalized PostGIS boundary.
-- save_finder_property has written this field since the portfolio migration,
-- but the table definition omitted it.
alter table public.property_boundaries
  add column if not exists source_geometry jsonb;

comment on column public.property_boundaries.source_geometry is
  'Original client-declared GeoJSON retained as provenance; boundary is the normalized spatial geometry.';
