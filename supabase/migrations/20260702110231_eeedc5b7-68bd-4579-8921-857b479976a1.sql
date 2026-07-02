-- Projects indexes
CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_unique_idx ON public.projects(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_external_id_unique_idx ON public.projects(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_region_idx ON public.projects(region);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);
CREATE INDEX IF NOT EXISTS projects_developer_idx ON public.projects(developer);
CREATE INDEX IF NOT EXISTS projects_chemistry_idx ON public.projects(chemistry);
CREATE INDEX IF NOT EXISTS projects_status_region_idx ON public.projects(status, region);

-- Articles indexes
CREATE INDEX IF NOT EXISTS articles_source_domain_idx ON public.articles(source_domain);

-- Ingestion runs sort index
CREATE INDEX IF NOT EXISTS ingestion_runs_started_at_desc_idx ON public.ingestion_runs(started_at DESC);

-- Drop duplicate GIN index (keep articles_search_idx)
DROP INDEX IF EXISTS public.articles_search_tsv_idx;