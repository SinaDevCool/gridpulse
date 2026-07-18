
-- News pipeline: RSS sources + ingestion runs (articles table is reused)

CREATE TABLE public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  feed_url text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'analysis',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.news_sources TO authenticated;
GRANT ALL ON public.news_sources TO service_role;

ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sources"
  ON public.news_sources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage sources"
  ON public.news_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER news_sources_set_updated_at
  BEFORE UPDATE ON public.news_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  fetched_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  summarized_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error text,
  triggered_by text NOT NULL DEFAULT 'cron'
);

GRANT SELECT ON public.ingestion_runs TO authenticated;
GRANT ALL ON public.ingestion_runs TO service_role;

ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ingestion runs"
  ON public.ingestion_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Ensure source_url uniqueness in articles so ingestion is idempotent
CREATE UNIQUE INDEX IF NOT EXISTS articles_source_url_unique
  ON public.articles (source_url) WHERE source_url IS NOT NULL;

-- Seed default RSS sources (energy storage / grid focused)
INSERT INTO public.news_sources (name, feed_url, category) VALUES
  ('Energy Storage News', 'https://www.energy-storage.news/feed/', 'analysis'),
  ('Utility Dive — Storage', 'https://www.utilitydive.com/feeds/topic/storage/', 'markets'),
  ('Canary Media', 'https://www.canarymedia.com/feeds/all-articles.xml', 'analysis'),
  ('pv magazine USA', 'https://pv-magazine-usa.com/feed/', 'technology'),
  ('EIA Today in Energy', 'https://www.eia.gov/tools/rss/todayinenergy.xml', 'policy'),
  ('Reuters Energy', 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', 'markets')
ON CONFLICT (feed_url) DO NOTHING;
