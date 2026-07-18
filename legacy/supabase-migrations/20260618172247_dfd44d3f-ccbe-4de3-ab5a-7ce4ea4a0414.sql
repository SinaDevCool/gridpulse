
-- Slice 6: Enrich projects with richer profile fields + slug routing
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS owner TEXT,
  ADD COLUMN IF NOT EXISTS operator TEXT,
  ADD COLUMN IF NOT EXISTS chemistry TEXT,
  ADD COLUMN IF NOT EXISTS use_case TEXT,
  ADD COLUMN IF NOT EXISTS offtaker TEXT,
  ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill slug from name (lowercase, hyphen-separated, suffixed with short id if needed)
UPDATE public.projects
SET slug = lower(
  regexp_replace(
    regexp_replace(coalesce(name,'project') || '-' || substr(id::text,1,6), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'
  )
)
WHERE slug IS NULL;

ALTER TABLE public.projects ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_unique ON public.projects(slug);

-- Backfill chemistry from technology when it's an obvious chemistry token (LFP / NMC / Flow / etc.)
UPDATE public.projects
SET chemistry = technology
WHERE chemistry IS NULL
  AND technology IN ('LFP','NMC','NCA','Flow','Vanadium Flow','Sodium-ion','LTO');

-- Helpful indexes for filtering
CREATE INDEX IF NOT EXISTS projects_region_idx ON public.projects(region);
CREATE INDEX IF NOT EXISTS projects_country_idx ON public.projects(country);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);
CREATE INDEX IF NOT EXISTS projects_chemistry_idx ON public.projects(chemistry);
CREATE INDEX IF NOT EXISTS projects_developer_idx ON public.projects(developer);
