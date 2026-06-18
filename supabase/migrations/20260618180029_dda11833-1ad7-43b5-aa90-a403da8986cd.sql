
-- Follows table: users can follow companies (by computed slug) and projects (by external_id).
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('company','project')),
  target_key TEXT NOT NULL,
  target_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_key)
);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own follows" ON public.follows
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users add own follows" ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users remove own follows" ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX follows_user_idx ON public.follows (user_id);
CREATE INDEX follows_target_idx ON public.follows (target_type, target_key);

-- Tier helper: returns 'enterprise' | 'pro' | 'free' for a given user.
CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'enterprise') OR public.has_role(_user_id, 'admin') THEN 'enterprise'
    WHEN public.has_role(_user_id, 'pro') OR public.has_paid_plan(_user_id) THEN 'pro'
    ELSE 'free'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tier(UUID) TO authenticated, service_role;

-- Partial unique index so follow notifications dedupe cleanly (no alert_rule_id).
CREATE UNIQUE INDEX IF NOT EXISTS notifications_follow_unique
  ON public.notifications (user_id, type, article_id, link)
  WHERE article_id IS NOT NULL AND type LIKE 'follow_%';
