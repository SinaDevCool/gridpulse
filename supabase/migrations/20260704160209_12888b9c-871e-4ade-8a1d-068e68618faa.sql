
-- Add country_code (ISO-3166 alpha-2) to projects and market_data.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE public.market_data ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Constrain to 2-letter uppercase ISO codes when present.
ALTER TABLE public.projects
  ADD CONSTRAINT projects_country_code_iso2_chk
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
ALTER TABLE public.market_data
  ADD CONSTRAINT market_data_country_code_iso2_chk
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

-- Backfill and normalize project country names.
UPDATE public.projects SET country_code='US', country='United States'
  WHERE country IN ('US','USA','United States');
UPDATE public.projects SET country_code='DE', country='Germany'
  WHERE country IN ('DE','Germany');
UPDATE public.projects SET country_code='GB', country='United Kingdom'
  WHERE country IN ('UK','GB','United Kingdom','Britain');
UPDATE public.projects SET country_code='AU' WHERE country='Australia';
UPDATE public.projects SET country_code='CN' WHERE country='China';
UPDATE public.projects SET country_code='JP' WHERE country='Japan';
UPDATE public.projects SET country_code='IN' WHERE country='India';
UPDATE public.projects SET country_code='CL' WHERE country='Chile';
UPDATE public.projects SET country_code='ES' WHERE country='Spain';
UPDATE public.projects SET country_code='SA' WHERE country='Saudi Arabia';
UPDATE public.projects SET country_code='NZ' WHERE country='New Zealand';
UPDATE public.projects SET country_code='AE' WHERE country IN ('UAE','United Arab Emirates');
UPDATE public.projects SET country_code='ZA' WHERE country='South Africa';

-- Indexes for country_code
CREATE INDEX IF NOT EXISTS projects_country_code_idx ON public.projects(country_code);
CREATE INDEX IF NOT EXISTS market_data_country_code_idx ON public.market_data(country_code);
