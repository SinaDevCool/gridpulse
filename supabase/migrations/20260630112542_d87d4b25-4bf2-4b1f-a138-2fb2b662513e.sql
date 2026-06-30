-- Track AI-driven project extraction per article so the cron job is idempotent.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS project_extraction_at timestamptz,
  ADD COLUMN IF NOT EXISTS project_extraction_status text;

CREATE INDEX IF NOT EXISTS articles_project_extraction_at_idx
  ON public.articles (project_extraction_at)
  WHERE project_extraction_at IS NULL;