-- Supabase default privileges can grant anon directly, independently of PUBLIC.
-- Keep these editing commands authenticated-only without changing invoker RLS.
revoke execute on function public.gridpulse_prefer_strategy(uuid, uuid, text) from anon;
revoke execute on function public.gridpulse_record_strategy_decision(uuid, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.gridpulse_append_flexibility(uuid, jsonb) from anon;
revoke execute on function public.gridpulse_append_strategy_package(uuid, jsonb) from anon;
revoke execute on function public.gridpulse_append_strategy_simulation(uuid, jsonb) from anon;
