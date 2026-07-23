-- Auditable, failure-safe controls for publishing external grid datasets.

create table public.grid_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_url text not null,
  artifact_sha256 text,
  connector_version text not null,
  parser_version text not null,
  geographic_scope text not null,
  status text not null default 'started'
    check (status in ('started','downloaded','parsing','staged','validating','published','failed','rejected')),
  records_read bigint not null default 0 check (records_read >= 0),
  records_staged bigint not null default 0 check (records_staged >= 0),
  records_rejected bigint not null default 0 check (records_rejected >= 0),
  validation_report jsonb not null default '{}'::jsonb,
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create table public.grid_dataset_releases (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete restrict,
  source_artifact_id uuid not null references public.grid_source_artifacts(id) on delete restrict,
  ingestion_run_id uuid not null unique references public.grid_ingestion_runs(id) on delete restrict,
  geographic_scope text not null,
  status text not null default 'staging'
    check (status in ('staging','validating','active','superseded','rejected','rolled_back')),
  record_count bigint not null check (record_count >= 0),
  validation_report jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.canonical_energy_assets
  add column if not exists dataset_release_id uuid
    references public.grid_dataset_releases(id) on delete set null;

create index grid_ingestion_runs_source_started_idx
  on public.grid_ingestion_runs(source_id, started_at desc);
create index grid_dataset_releases_source_status_idx
  on public.grid_dataset_releases(source_id, status, created_at desc);
create index canonical_energy_assets_release_idx
  on public.canonical_energy_assets(dataset_release_id);

alter table public.grid_ingestion_runs enable row level security;
alter table public.grid_dataset_releases enable row level security;

drop policy if exists "authenticated users read energy assets"
  on public.canonical_energy_assets;
create policy "authenticated users read active energy releases"
  on public.canonical_energy_assets for select to authenticated
  using (
    dataset_release_id is null
    or exists (
      select 1
      from public.grid_dataset_releases release
      where release.id = dataset_release_id and release.status = 'active'
    )
  );
create policy "authenticated users read ingestion health"
  on public.grid_ingestion_runs for select to authenticated using (true);
create policy "authenticated users read dataset releases"
  on public.grid_dataset_releases for select to authenticated using (true);

create or replace function public.activate_grid_dataset_release(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.grid_dataset_releases;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select * into target
  from public.grid_dataset_releases
  where id = p_release_id
  for update;

  if target.id is null then
    raise exception 'dataset release not found';
  end if;
  if target.status <> 'validating' then
    raise exception 'release must be validating before activation';
  end if;
  if coalesce((target.validation_report ->> 'valid')::boolean, false) is not true then
    raise exception 'release validation has not passed';
  end if;

  update public.grid_dataset_releases
  set status = 'superseded', superseded_at = now()
  where source_id = target.source_id and status = 'active' and id <> target.id;

  update public.grid_dataset_releases
  set status = 'active', activated_at = now()
  where id = target.id;

  update public.grid_ingestion_runs
  set status = 'published', finished_at = now()
  where id = target.ingestion_run_id;
end;
$$;

revoke all on function public.activate_grid_dataset_release(uuid) from public, anon, authenticated;
grant execute on function public.activate_grid_dataset_release(uuid) to service_role;

comment on table public.grid_ingestion_runs is
  'Immutable operational history for external-source ingestion attempts, including failed runs.';
comment on table public.grid_dataset_releases is
  'Validated source releases. Only active releases should drive public screening context.';
