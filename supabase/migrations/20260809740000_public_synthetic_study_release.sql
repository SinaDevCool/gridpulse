-- Public-safe release registry for the no-login synthetic network study.
-- This table stores provenance and UI release metadata only. It deliberately
-- does not store or expose a claim about real German node capacity.

create table if not exists public.synthetic_demo_releases (
  release_key text primary key,
  model_id text not null,
  model_version text not null,
  validation_class text not null check (validation_class = 'synthetic_demonstration'),
  evidence_origin text not null check (evidence_origin = 'synthetic_fixture'),
  replacement_contract text not null default 'operator_pilot_data_v1',
  artifact_sha256 text not null,
  release_payload jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  check (coalesce((release_payload->>'capacity_claim')::boolean, false) = false),
  check (coalesce((release_payload->>'operator_confirmed')::boolean, false) = false),
  check (release_payload->>'watermark' is not null)
);
alter table public.synthetic_demo_releases enable row level security;
revoke all on public.synthetic_demo_releases from public, anon, authenticated;
grant select, insert, update, delete on public.synthetic_demo_releases to service_role;
create unique index if not exists synthetic_demo_one_active_release
  on public.synthetic_demo_releases(active) where active;
insert into public.synthetic_demo_releases (
  release_key, model_id, model_version, validation_class, evidence_origin,
  artifact_sha256, active, release_payload
) values (
  'synthetic-brandenburg-demo-v1',
  'synthetic-brandenburg-pilot-network-v1',
  '1.0.0',
  'synthetic_demonstration',
  'synthetic_fixture',
  'fcb5288b66656cd3dba3d0d6c8491bc9509d361fbe17583b4c3eb2e2a056b494',
  true,
  jsonb_build_object(
    'schema_version', 'gridpulse-synthetic-study-release-v1',
    'workspace_id', 'synthetic-brandenburg-demo-v1',
    'watermark', 'Synthetic German network study — representative benchmark data, not actual or operator-confirmed grid capacity.',
    'graph_provider', 'neo4j-compatible-bounded-projection',
    'solver', 'pandapower-newton-raphson',
    'provider_contract', 'operator_pilot_data_v1',
    'capacity_claim', false,
    'operator_confirmed', false
  )
) on conflict (release_key) do update set
  model_version = excluded.model_version,
  artifact_sha256 = excluded.artifact_sha256,
  release_payload = excluded.release_payload,
  active = excluded.active;
create or replace function public.public_synthetic_demo_release()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
      'release_key', release_key,
      'model_id', model_id,
      'model_version', model_version,
      'validation_class', validation_class,
      'evidence_origin', evidence_origin,
      'replacement_contract', replacement_contract,
      'artifact_sha256', artifact_sha256,
      'release_payload', release_payload,
      'capacity_claim', false,
      'operator_confirmed', false
    ) from public.synthetic_demo_releases where active limit 1),
    jsonb_build_object('available', false, 'capacity_claim', false, 'operator_confirmed', false)
  );
$$;
revoke all on function public.public_synthetic_demo_release() from public;
grant execute on function public.public_synthetic_demo_release() to anon, authenticated;
comment on table public.synthetic_demo_releases is
  'Public-safe synthetic demo provenance. Never represents actual, available or operator-confirmed grid capacity.';
