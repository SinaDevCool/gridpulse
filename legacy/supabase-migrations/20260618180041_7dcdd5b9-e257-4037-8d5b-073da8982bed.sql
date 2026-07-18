
REVOKE EXECUTE ON FUNCTION public.get_user_tier(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_tier(UUID) TO authenticated, service_role;
