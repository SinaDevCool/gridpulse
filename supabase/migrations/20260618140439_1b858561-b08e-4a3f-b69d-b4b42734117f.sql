
-- Revoke broad EXECUTE on SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Newsletter: replace the permissive WITH CHECK (true) with a real constraint.
DROP POLICY "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe with a valid email" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(email) BETWEEN 4 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );
