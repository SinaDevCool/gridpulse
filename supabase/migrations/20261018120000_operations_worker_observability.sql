-- Worker fleet health is service-only. No measurement or tenant payload is exposed.
create table public.analytics_worker_heartbeats (
  worker_id text primary key check (length(worker_id) between 1 and 200),
  environment text not null check (environment in ('development','test','staging','production')),
  revision text not null check (length(revision) <= 100),
  state text not null check (state in ('idle','busy','stopping')),
  observed_at timestamptz not null default now()
);
alter table public.analytics_worker_heartbeats enable row level security;
revoke all on public.analytics_worker_heartbeats from public, anon, authenticated;
grant select, insert, update, delete on public.analytics_worker_heartbeats to service_role;

create function public.operations_worker_heartbeat(p_worker_id text, p_environment text,
  p_revision text, p_state text)
returns void language sql security definer set search_path=public as $$
  insert into public.analytics_worker_heartbeats(worker_id,environment,revision,state,observed_at)
  values(p_worker_id,p_environment,p_revision,p_state,now())
  on conflict(worker_id) do update set environment=excluded.environment,
    revision=excluded.revision,state=excluded.state,observed_at=now();
$$;
revoke all on function public.operations_worker_heartbeat(text,text,text,text) from public,anon,authenticated;
grant execute on function public.operations_worker_heartbeat(text,text,text,text) to service_role;
