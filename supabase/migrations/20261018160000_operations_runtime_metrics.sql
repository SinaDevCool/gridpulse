create function public.operations_runtime_metrics(p_environment text,p_revision text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'queued_jobs',(select count(*) from public.analytics_jobs where status='queued'),
    'running_jobs',(select count(*) from public.analytics_jobs where status='running'),
    'failed_last_hour',(select count(*) from public.analytics_jobs where status='failed' and completed_at>now()-interval '1 hour'),
    'expired_running_leases',(select count(*) from public.analytics_jobs where status='running' and lease_expires_at<now()),
    'oldest_queued_age_seconds',(select coalesce(greatest(0,extract(epoch from now()-min(created_at))),0) from public.analytics_jobs where status='queued'),
    'available_workers',(select count(*) from public.analytics_worker_heartbeats where environment=p_environment and revision=p_revision and observed_at>now()-interval '90 seconds' and state in ('idle','busy'))
  );
$$;
revoke all on function public.operations_runtime_metrics(text,text) from public,anon,authenticated;
grant execute on function public.operations_runtime_metrics(text,text) to service_role;
