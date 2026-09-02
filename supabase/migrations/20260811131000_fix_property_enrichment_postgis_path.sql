-- PostGIS is installed in the extensions schema in hosted Supabase projects.
-- Keep the SECURITY DEFINER path fixed to trusted schemas while allowing
-- geography casts and gen_random_uuid() to resolve at execution time.
alter function public.property_enrichment_batch(jsonb, text[])
  set search_path = pg_catalog, public, extensions;

