CREATE TABLE public.market_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('stock','commodity','index','metric')),
  label text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  currency text,
  change_abs numeric,
  change_pct numeric,
  source_name text NOT NULL,
  source_type text NOT NULL DEFAULT 'api' CHECK (source_type IN ('api','manual','rss','seed')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified','unverified','demo')),
  captured_at timestamptz NOT NULL DEFAULT now(),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, captured_at)
);

CREATE INDEX market_data_symbol_captured_idx ON public.market_data (symbol, captured_at DESC);
CREATE INDEX market_data_kind_idx ON public.market_data (kind);

GRANT SELECT ON public.market_data TO anon;
GRANT SELECT ON public.market_data TO authenticated;
GRANT ALL ON public.market_data TO service_role;

ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market data is publicly readable"
  ON public.market_data FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role manages market data"
  ON public.market_data FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER market_data_set_updated_at
  BEFORE UPDATE ON public.market_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Latest snapshot per symbol
CREATE OR REPLACE VIEW public.market_data_latest AS
SELECT DISTINCT ON (symbol)
  id, symbol, kind, label, value, unit, currency,
  change_abs, change_pct, source_name, source_type,
  verification_status, captured_at, fetched_at, metadata
FROM public.market_data
ORDER BY symbol, captured_at DESC;

GRANT SELECT ON public.market_data_latest TO anon, authenticated;
