-- Node-intelligence foundation: project-scoped network context, assets, capacity evidence and reproducible studies.
-- These records support screening and operator engagement. They are not proof of available capacity.

create or replace function public.can_manage_network_intelligence(p_site_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.get_assessment_role(p_site_id) in ('technical_reviewer','grid_expert','workspace_admin');
$$;
revoke all on function public.can_manage_network_intelligence(uuid) from public;
grant execute on function public.can_manage_network_intelligence(uuid) to authenticated;

create or replace function public.can_read_network_record(p_site_id uuid, p_confidentiality text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_read_assessment(p_site_id) and case p_confidentiality
    when 'public_context' then true
    when 'project_participants' then true
    when 'reviewers' then public.get_assessment_role(p_site_id) in ('technical_reviewer','commercial_reviewer','grid_expert','workspace_admin')
    when 'operator_restricted' then public.get_assessment_role(p_site_id) in ('grid_expert','workspace_admin')
    else false
  end;
$$;
revoke all on function public.can_read_network_record(uuid,text) from public;
grant execute on function public.can_read_network_record(uuid,text) to authenticated;

create table public.network_nodes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  node_name text not null check (char_length(node_name) between 2 and 160),
  node_code text,
  operator_name text not null check (char_length(operator_name) between 2 and 160),
  operator_reference text,
  node_type text not null check (node_type in ('substation','switching_station','connection_point','busbar','grid_interface','unknown')),
  voltage_kv numeric not null check (voltage_kv > 0 and voltage_kv <= 1000),
  latitude numeric check (latitude is null or latitude between -90 and 90),
  longitude numeric check (longitude is null or longitude between -180 and 180),
  municipality text,
  federal_state text,
  source_classification text not null default 'public_context'
    check (source_classification in ('public_context','customer_declared','engineering_model','operator_statement')),
  confidence text not null default 'low' check (confidence in ('low','medium','high','operator_confirmed')),
  confidentiality text not null default 'project_participants'
    check (confidentiality in ('public_context','project_participants','reviewers','operator_restricted')),
  source_url text,
  source_document_id uuid references public.assessment_documents(id) on delete set null,
  valid_from timestamptz,
  valid_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to > valid_from)
);

create table public.network_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  asset_name text not null check (char_length(asset_name) between 2 and 160),
  asset_code text,
  asset_type text not null check (asset_type in ('transformer','line','cable','busbar','switchgear','connection_bay','upstream_interface','other')),
  from_node_id uuid references public.network_nodes(id) on delete set null,
  to_node_id uuid references public.network_nodes(id) on delete set null,
  voltage_kv numeric check (voltage_kv is null or voltage_kv > 0),
  normal_rating_mva numeric check (normal_rating_mva is null or normal_rating_mva >= 0),
  emergency_rating_mva numeric check (emergency_rating_mva is null or emergency_rating_mva >= 0),
  operational_status text not null default 'unknown'
    check (operational_status in ('planned','construction','operational','out_of_service','unknown')),
  electrical_parameters jsonb not null default '{}'::jsonb,
  source_classification text not null default 'public_context'
    check (source_classification in ('public_context','customer_declared','engineering_model','operator_statement')),
  confidence text not null default 'low' check (confidence in ('low','medium','high','operator_confirmed')),
  confidentiality text not null default 'project_participants'
    check (confidentiality in ('public_context','project_participants','reviewers','operator_restricted')),
  source_url text,
  source_document_id uuid references public.assessment_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_node_id is not null or to_node_id is not null),
  check (emergency_rating_mva is null or normal_rating_mva is null or emergency_rating_mva >= normal_rating_mva)
);

create table public.study_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  node_id uuid references public.network_nodes(id) on delete set null,
  study_name text not null check (char_length(study_name) between 2 and 180),
  study_type text not null check (study_type in ('screening','load_flow','n_1','short_circuit','voltage','power_quality','fca_envelope','operator_validation')),
  model_name text not null,
  model_version text not null,
  software_name text,
  software_version text,
  input_manifest jsonb not null default '{}'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  contingencies jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  violations jsonb not null default '[]'::jsonb,
  result_hash text,
  status text not null default 'draft' check (status in ('draft','queued','running','completed','failed','reviewed','operator_confirmed','superseded')),
  source_classification text not null default 'engineering_model'
    check (source_classification in ('public_context','customer_declared','engineering_model','operator_statement')),
  confidence text not null default 'low' check (confidence in ('low','medium','high','operator_confirmed')),
  confidentiality text not null default 'reviewers'
    check (confidentiality in ('public_context','project_participants','reviewers','operator_restricted')),
  source_document_id uuid references public.assessment_documents(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  check (status <> 'operator_confirmed' or (source_classification = 'operator_statement' and source_document_id is not null and confidence = 'operator_confirmed'))
);

create table public.capacity_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  node_id uuid not null references public.network_nodes(id) on delete cascade,
  study_run_id uuid references public.study_runs(id) on delete set null,
  version integer not null default 0 check (version > 0),
  capacity_kind text not null check (capacity_kind in ('screening_estimate','engineering_result','operator_statement','contractual_limit')),
  firm_import_mw numeric check (firm_import_mw is null or firm_import_mw >= 0),
  firm_export_mw numeric check (firm_export_mw is null or firm_export_mw >= 0),
  conditional_import_mw numeric check (conditional_import_mw is null or conditional_import_mw >= 0),
  conditional_export_mw numeric check (conditional_export_mw is null or conditional_export_mw >= 0),
  known_commitments_mw numeric check (known_commitments_mw is null or known_commitments_mw >= 0),
  queued_capacity_mw numeric check (queued_capacity_mw is null or queued_capacity_mw >= 0),
  network_state text not null default 'unknown' check (network_state in ('normal','n_1','maintenance','constrained','mixed','unknown')),
  time_resolution_minutes integer check (time_resolution_minutes is null or time_resolution_minutes > 0),
  conditional_envelope jsonb not null default '[]'::jsonb,
  methodology_version text,
  observed_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_to timestamptz,
  status text not null default 'draft' check (status in ('draft','reviewed','operator_confirmed','superseded','expired')),
  source_classification text not null default 'engineering_model'
    check (source_classification in ('public_context','customer_declared','engineering_model','operator_statement')),
  confidence text not null default 'low' check (confidence in ('low','medium','high','operator_confirmed')),
  confidentiality text not null default 'reviewers'
    check (confidentiality in ('public_context','project_participants','reviewers','operator_restricted')),
  source_url text,
  source_document_id uuid references public.assessment_documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(node_id, version),
  check (valid_to is null or valid_from is null or valid_to > valid_from),
  check (status <> 'operator_confirmed' or (capacity_kind in ('operator_statement','contractual_limit') and source_classification = 'operator_statement' and source_document_id is not null and confidence = 'operator_confirmed'))
);

create or replace function public.assign_capacity_snapshot_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.node_id::text, 0));
  if new.version is null or new.version < 1 then
    select coalesce(max(version), 0) + 1 into new.version from public.capacity_snapshots where node_id = new.node_id;
  end if;
  return new;
end;
$$;
create trigger capacity_snapshots_assign_version before insert on public.capacity_snapshots
for each row execute function public.assign_capacity_snapshot_version();

alter table public.network_nodes enable row level security;
alter table public.network_assets enable row level security;
alter table public.study_runs enable row level security;
alter table public.capacity_snapshots enable row level security;

create policy "authorised participants read nodes" on public.network_nodes for select to authenticated
using (public.can_read_network_record(site_id, confidentiality));
create policy "network specialists manage nodes" on public.network_nodes for all to authenticated
using (public.can_manage_network_intelligence(site_id)) with check (public.can_manage_network_intelligence(site_id));
create policy "authorised participants read assets" on public.network_assets for select to authenticated
using (public.can_read_network_record(site_id, confidentiality));
create policy "network specialists manage assets" on public.network_assets for all to authenticated
using (public.can_manage_network_intelligence(site_id)) with check (public.can_manage_network_intelligence(site_id));
create policy "authorised participants read studies" on public.study_runs for select to authenticated
using (public.can_read_network_record(site_id, confidentiality));
create policy "network specialists manage studies" on public.study_runs for all to authenticated
using (public.can_manage_network_intelligence(site_id)) with check (public.can_manage_network_intelligence(site_id));
create policy "authorised participants read capacity" on public.capacity_snapshots for select to authenticated
using (public.can_read_network_record(site_id, confidentiality));
create policy "network specialists manage capacity" on public.capacity_snapshots for all to authenticated
using (public.can_manage_network_intelligence(site_id)) with check (public.can_manage_network_intelligence(site_id));

create index network_nodes_site_idx on public.network_nodes(site_id, created_at desc);
create index network_assets_site_idx on public.network_assets(site_id, created_at desc);
create index network_assets_nodes_idx on public.network_assets(from_node_id, to_node_id);
create index study_runs_site_node_idx on public.study_runs(site_id, node_id, created_at desc);
create index capacity_snapshots_site_node_idx on public.capacity_snapshots(site_id, node_id, version desc);

create or replace function public.touch_node_intelligence_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger network_nodes_updated_at before update on public.network_nodes
for each row execute function public.touch_node_intelligence_updated_at();
create trigger network_assets_updated_at before update on public.network_assets
for each row execute function public.touch_node_intelligence_updated_at();
create trigger study_runs_updated_at before update on public.study_runs
for each row execute function public.touch_node_intelligence_updated_at();
create trigger capacity_snapshots_updated_at before update on public.capacity_snapshots
for each row execute function public.touch_node_intelligence_updated_at();

create trigger network_nodes_activity after insert or update or delete on public.network_nodes
for each row execute function public.log_assessment_change();
create trigger network_assets_activity after insert or update or delete on public.network_assets
for each row execute function public.log_assessment_change();
create trigger study_runs_activity after insert or update or delete on public.study_runs
for each row execute function public.log_assessment_change();
create trigger capacity_snapshots_activity after insert or update or delete on public.capacity_snapshots
for each row execute function public.log_assessment_change();

comment on table public.capacity_snapshots is 'Versioned node-capacity evidence. Only operator-confirmed rows backed by an operator source document may be described as confirmed; other rows are screening or engineering evidence.';
comment on table public.study_runs is 'Reproducible study ledger. A completed internal study is not an operator-approved power-flow or connection decision.';
