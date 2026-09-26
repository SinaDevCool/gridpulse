-- The schema-v6 wrapper performs geography casts after the earlier v5 RPC was
-- renamed. Hosted Supabase installs PostGIS types in the extensions schema, so
-- keep the SECURITY DEFINER path limited to trusted schemas while allowing the
-- wrapper's geography casts to resolve.
alter function public.property_enrichment_batch(jsonb, text[])
  set search_path = pg_catalog, public, extensions;
