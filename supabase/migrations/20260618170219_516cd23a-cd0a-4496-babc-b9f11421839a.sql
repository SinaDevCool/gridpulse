
-- 1) Full-text search on projects (articles already has this)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(developer,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(location,'') || ' ' || coalesce(country,'') || ' ' || coalesce(region,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(technology,'') || ' ' || coalesce(status,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(description,'')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS projects_search_tsv_idx ON public.projects USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS articles_search_tsv_idx ON public.articles USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS articles_tags_gin_idx ON public.articles USING GIN (tags);

-- 2) Paid-plan helper (ignores environment so it works in sandbox + live)
CREATE OR REPLACE FUNCTION public.has_paid_plan(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status IN ('active','trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('pro','enterprise','admin')
  );
$$;

-- 3) Enums
DO $$ BEGIN
  CREATE TYPE public.alert_frequency AS ENUM ('instant','daily','weekly','off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_rule_type AS ENUM ('keyword','tag','company','region','technology','market','category');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) saved_searches
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  query text NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own saved searches"
  ON public.saved_searches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Pro users create saved searches"
  ON public.saved_searches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_paid_plan(auth.uid()));
CREATE POLICY "Users update own saved searches"
  ON public.saved_searches FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved searches"
  ON public.saved_searches FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX saved_searches_user_idx ON public.saved_searches (user_id, created_at DESC);

-- 5) alert_rules
CREATE TABLE public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  rule_type public.alert_rule_type NOT NULL,
  values text[] NOT NULL DEFAULT '{}',
  frequency public.alert_frequency NOT NULL DEFAULT 'daily',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own alert rules"
  ON public.alert_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Pro users create alert rules"
  ON public.alert_rules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_paid_plan(auth.uid()));
CREATE POLICY "Users update own alert rules"
  ON public.alert_rules FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own alert rules"
  ON public.alert_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX alert_rules_user_idx ON public.alert_rules (user_id);
CREATE INDEX alert_rules_active_freq_idx ON public.alert_rules (frequency, active) WHERE active = true;

-- 6) notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'alert',
  title text NOT NULL,
  body text,
  link text,
  alert_rule_id uuid REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_recent_idx
  ON public.notifications (user_id, created_at DESC);

-- Dedupe an article+rule pair so re-runs don't spam
CREATE UNIQUE INDEX notifications_alert_dedupe_idx
  ON public.notifications (user_id, alert_rule_id, article_id)
  WHERE alert_rule_id IS NOT NULL AND article_id IS NOT NULL;
