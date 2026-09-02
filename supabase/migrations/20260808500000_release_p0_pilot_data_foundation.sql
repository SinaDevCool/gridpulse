-- Release P0: private, provenance-first pilot datasets and replaceable operator-data contracts.

create table if not exists public.pilot_datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  dataset_key text not null,
  dataset_version text not null,
  title text not null,
  geographic_scope text not null,
  evidence_class text not null check (evidence_class in ('official_public','open_mapping','customer_supplied','operator_supplied','synthetic')),
  validation_class text not null check (validation_class in ('public_screening','synthetic_demonstration','operator_model_unvalidated','operator_model_reconciled','operator_reviewed','operator_confirmed')),
  is_synthetic boolean not null,
  source_id text not null,
  replacement_contract text not null,
  dataset_sha256 text not null check (dataset_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'candidate' check (status in ('candidate','accepted','superseded','rejected')),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(owner_id, dataset_key, dataset_version),
  check (is_synthetic = (evidence_class = 'synthetic')),
  check (not is_synthetic or validation_class = 'synthetic_demonstration'),
  check (evidence_class <> 'operator_supplied' or validation_class in ('operator_model_unvalidated','operator_model_reconciled','operator_reviewed','operator_confirmed'))
);

create table if not exists public.pilot_source_artifacts (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.pilot_datasets(id) on delete cascade,
  artifact_key text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  storage_uri text,
  source_url text,
  licence text not null,
  parser_version text,
  accepted boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(dataset_id, artifact_key),
  unique(dataset_id, artifact_sha256)
);

create table if not exists public.pilot_model_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.pilot_datasets(id) on delete restrict,
  model_key text not null,
  model_version text not null,
  model_sha256 text not null check (model_sha256 ~ '^[a-f0-9]{64}$'),
  validation_class text not null check (validation_class in ('synthetic_demonstration','operator_model_unvalidated','operator_model_reconciled','operator_reviewed','operator_confirmed')),
  network_format text not null,
  element_counts jsonb not null,
  status text not null default 'candidate' check (status in ('candidate','accepted','superseded','rejected')),
  created_at timestamptz not null default now(),
  unique(dataset_id, model_key, model_version)
);

create table if not exists public.pilot_validation_events (
  id bigint generated always as identity primary key,
  dataset_id uuid not null references public.pilot_datasets(id) on delete restrict,
  model_version_id uuid references public.pilot_model_versions(id) on delete restrict,
  event_type text not null,
  prior_validation_class text,
  target_validation_class text not null,
  passed boolean not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (target_validation_class in ('synthetic_demonstration','operator_model_unvalidated','operator_model_reconciled','operator_reviewed','operator_confirmed'))
);

create table if not exists public.pilot_dataset_replacements (
  id uuid primary key default gen_random_uuid(),
  synthetic_dataset_id uuid not null references public.pilot_datasets(id) on delete restrict,
  operator_dataset_id uuid not null references public.pilot_datasets(id) on delete restrict,
  replacement_contract text not null,
  compatibility_report jsonb not null,
  passed boolean not null,
  created_at timestamptz not null default now(),
  unique(synthetic_dataset_id, operator_dataset_id),
  check (synthetic_dataset_id <> operator_dataset_id)
);

create index if not exists pilot_datasets_status_idx on public.pilot_datasets(status, validation_class);
create index if not exists pilot_source_artifacts_dataset_idx on public.pilot_source_artifacts(dataset_id);
create index if not exists pilot_validation_events_dataset_idx on public.pilot_validation_events(dataset_id, id);

alter table public.pilot_datasets enable row level security;
alter table public.pilot_source_artifacts enable row level security;
alter table public.pilot_model_versions enable row level security;
alter table public.pilot_validation_events enable row level security;
alter table public.pilot_dataset_replacements enable row level security;

revoke all on public.pilot_datasets, public.pilot_source_artifacts, public.pilot_model_versions, public.pilot_validation_events, public.pilot_dataset_replacements from public, anon, authenticated;
grant select, insert, update, delete on public.pilot_datasets, public.pilot_source_artifacts, public.pilot_model_versions, public.pilot_validation_events, public.pilot_dataset_replacements to service_role;
grant usage, select on sequence public.pilot_validation_events_id_seq to service_role;

create or replace function public.prevent_synthetic_pilot_promotion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_synthetic and new.validation_class <> 'synthetic_demonstration' then
    raise exception 'Synthetic pilot data cannot be promoted';
  end if;
  return new;
end $$;

drop trigger if exists pilot_datasets_fail_closed on public.pilot_datasets;
create trigger pilot_datasets_fail_closed
before insert or update on public.pilot_datasets
for each row execute function public.prevent_synthetic_pilot_promotion();

create or replace function public.prevent_synthetic_model_promotion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare dataset_is_synthetic boolean;
begin
  select is_synthetic into dataset_is_synthetic from public.pilot_datasets where id = new.dataset_id;
  if dataset_is_synthetic and new.validation_class <> 'synthetic_demonstration' then
    raise exception 'A model backed by synthetic pilot data cannot be promoted';
  end if;
  return new;
end $$;

drop trigger if exists pilot_model_versions_fail_closed on public.pilot_model_versions;
create trigger pilot_model_versions_fail_closed
before insert or update on public.pilot_model_versions
for each row execute function public.prevent_synthetic_model_promotion();

comment on table public.pilot_datasets is 'Private P0 registry. Synthetic records can never represent operator-confirmed capacity.';
comment on table public.pilot_dataset_replacements is 'Audited compatibility link used when a synthetic fixture is replaced by operator-supplied pilot data.';
