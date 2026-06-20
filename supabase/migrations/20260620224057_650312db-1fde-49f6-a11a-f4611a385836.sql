
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

-- Backfill articles
UPDATE public.articles
  SET source_type = 'rss',
      fetched_at = COALESCE(fetched_at, published_at),
      last_verified_at = COALESCE(last_verified_at, published_at),
      verification_status = CASE WHEN verified THEN 'verified' ELSE 'unverified' END
  WHERE source_url IS NOT NULL;

UPDATE public.articles
  SET source_type = 'seed',
      verification_status = 'demo'
  WHERE source_url IS NULL;

-- All current projects are seeded fictional records
UPDATE public.projects
  SET source_type = 'seed',
      verification_status = 'demo';
