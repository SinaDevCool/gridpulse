-- Official operator evidence for the Brandenburg Power Finder.
-- Publication metadata, project context, and node matching are kept separate from capacity.

create table public.operator_source_endpoints (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.grid_operators(id) on delete cascade,
  source_id text not null references public.grid_sources(id) on delete restrict,
  endpoint_key text not null,
  title text not null,
  endpoint_url text not null,
  source_kind text not null
    check (source_kind in ('connection_map','connection_process','project_page','technical_rules','portal')),
  demand_relevance text not null
    check (demand_relevance in ('direct','context_only','none')),
  access_mode text not null
    check (access_mode in ('public_page','public_map','account_portal','document')),
  legal_boundary text not null,
  refresh_cadence text not null default 'monthly',
  active boolean not null default true,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(operator_id, endpoint_key)
);

create table public.operator_evidence_documents (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.operator_source_endpoints(id) on delete cascade,
  source_artifact_id uuid references public.grid_source_artifacts(id) on delete set null,
  document_key text not null,
  title text not null,
  document_url text not null,
  evidence_type text not null
    check (evidence_type in ('capacity_map','process_notice','grid_project','technical_rules','portal_description')),
  evidence_status text not null default 'public_source'
    check (evidence_status in ('public_source','derived','operator_confirmed','superseded')),
  applicable_from date,
  applicable_to date,
  assessed_at date,
  extracted_facts jsonb not null default '{}'::jsonb,
  caveats text[] not null default '{}',
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  retrieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(endpoint_id, document_key)
);

create table public.operator_grid_projects (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.grid_operators(id) on delete cascade,
  evidence_document_id uuid references public.operator_evidence_documents(id) on delete set null,
  project_key text not null,
  project_name text not null,
  project_status text not null
    check (project_status in ('proposed','consultation','permitting','construction','commissioned','unknown')),
  project_type text not null
    check (project_type in ('substation','line','reinforcement','connection','other')),
  voltage_kv numeric[] not null default '{}',
  expected_service_date date,
  geometry extensions.geometry(Geometry, 4326),
  summary text not null,
  source_url text not null,
  evidence_status text not null default 'public_source'
    check (evidence_status in ('public_source','derived','operator_confirmed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(operator_id, project_key)
);

create table public.operator_node_evidence_matches (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.canonical_grid_nodes(id) on delete cascade,
  evidence_document_id uuid references public.operator_evidence_documents(id) on delete cascade,
  grid_project_id uuid references public.operator_grid_projects(id) on delete cascade,
  match_method text not null
    check (match_method in ('source_identifier','name_voltage','spatial','operator_scope','manual')),
  confidence numeric not null check (confidence between 0 and 1),
  distance_m numeric check (distance_m is null or distance_m >= 0),
  status text not null default 'proposed'
    check (status in ('proposed','accepted','rejected','superseded')),
  rationale text not null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (evidence_document_id is not null or grid_project_id is not null)
);

create index operator_source_endpoints_operator_idx
  on public.operator_source_endpoints(operator_id, active);
create index operator_evidence_documents_endpoint_idx
  on public.operator_evidence_documents(endpoint_id, evidence_status);
create index operator_grid_projects_geometry_idx on public.operator_grid_projects using gist (geometry);
create index operator_node_evidence_matches_node_idx
  on public.operator_node_evidence_matches(node_id, status, confidence desc);

alter table public.operator_source_endpoints enable row level security;
alter table public.operator_evidence_documents enable row level security;
alter table public.operator_grid_projects enable row level security;
alter table public.operator_node_evidence_matches enable row level security;

create policy "authenticated users read active operator endpoints"
  on public.operator_source_endpoints for select to authenticated using (active);
create policy "authenticated users read current operator evidence"
  on public.operator_evidence_documents for select to authenticated
  using (evidence_status <> 'superseded');
create policy "authenticated users read operator grid projects"
  on public.operator_grid_projects for select to authenticated using (true);
create policy "authenticated users read accepted operator node matches"
  on public.operator_node_evidence_matches for select to authenticated
  using (status = 'accepted');

insert into public.grid_sources (
  id, publisher, title, source_url, licence, attribution, geographic_scope,
  evidence_class, refresh_cadence, last_verified_at
) values
  (
    '50hertz-netzanschluss-2026',
    '50Hertz Transmission GmbH',
    'Netzanschluss and indicative grid-capacity map',
    'https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss',
    'Publisher terms; metadata and links only unless reuse is separately permitted',
    'Source: 50Hertz Transmission GmbH',
    '50Hertz control area, Germany',
    'official_operator',
    'monthly and on advertised assessment-date change',
    now()
  ),
  (
    'edis-netzanschluss-public-2026',
    'E.DIS Netz GmbH',
    'Public grid-connection information and Netzanschlussmonitor',
    'https://www.e-dis-netz.de/de/energie-anschliessen/gewerbe-und-Industrie/netzanschluss-strom/stromanschluss-in-hochspannung.html',
    'Publisher terms; metadata and links only unless reuse is separately permitted',
    'Source: E.DIS Netz GmbH',
    'E.DIS distribution area, Germany',
    'official_operator',
    'monthly',
    now()
  )
on conflict (id) do update set
  source_url = excluded.source_url,
  refresh_cadence = excluded.refresh_cadence,
  last_verified_at = excluded.last_verified_at,
  updated_at = now();

insert into public.grid_operators (
  canonical_name, operator_type, aliases, website_url, connection_url, capacity_source_url,
  evidence_class, source_id, last_verified_at, metadata
) values
  (
    '50Hertz Transmission GmbH', 'tso',
    array['50Hertz','50 Hertz','50Hertz Transmission'],
    'https://www.50hertz.com/',
    'https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss',
    'https://www.50hertz.com/DesktopModules/Lotes/FrequentModules/API/DigitalMap/GetDnbMap?dnbMapId=netzkapazitaet/production-map',
    'official_operator', '50hertz-netzanschluss-2026', now(),
    '{"capacity_boundary":"Indicative maximum values; non-binding and project-specific assessment required."}'::jsonb
  ),
  (
    'E.DIS Netz GmbH', 'dso',
    array['E.DIS','E.DIS Netz','e.dis','Edis'],
    'https://www.e-dis-netz.de/',
    'https://www.e-dis-netz.de/de/energie-anschliessen/gewerbe-und-Industrie/netzanschluss-strom/stromanschluss-in-hochspannung.html',
    'https://netzanschlussmonitor.e-dis-netz.de/',
    'official_operator', 'edis-netzanschluss-public-2026', now(),
    '{"capacity_boundary":"Public monitor is generation-oriented and does not establish demand headroom."}'::jsonb
  )
on conflict (canonical_name) do update set
  aliases = excluded.aliases,
  connection_url = excluded.connection_url,
  capacity_source_url = excluded.capacity_source_url,
  source_id = excluded.source_id,
  last_verified_at = excluded.last_verified_at,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.operator_source_endpoints (
  operator_id, source_id, endpoint_key, title, endpoint_url, source_kind,
  demand_relevance, access_mode, legal_boundary, refresh_cadence, last_checked_at, metadata
)
select o.id, v.source_id, v.endpoint_key, v.title, v.endpoint_url, v.source_kind,
       v.demand_relevance, v.access_mode, v.legal_boundary, v.refresh_cadence, now(), v.metadata
from (
  values
    (
      '50Hertz Transmission GmbH', '50hertz-netzanschluss-2026', 'demand-capacity-map',
      '50Hertz indicative grid-capacity map',
      'https://www.50hertz.com/DesktopModules/Lotes/FrequentModules/API/DigitalMap/GetDnbMap?dnbMapId=netzkapazitaet/production-map',
      'connection_map', 'direct', 'public_map',
      'Non-binding orientation. Displayed values are maximum available connection power; exact capacity depends on project composition and location.',
      'monthly', '{"assessment_date":"2026-03-31","bulk_reuse":"not_assumed"}'::jsonb
    ),
    (
      '50Hertz Transmission GmbH', '50hertz-netzanschluss-2026', 'connection-process',
      '50Hertz grid-connection process',
      'https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss',
      'connection_process', 'context_only', 'public_page',
      'Process information is not a connection offer, capacity reservation, or approval.',
      'monthly', '{"maturity_procedure_start":"2026-04-01","first_cycle_deadline":"2026-06-30"}'::jsonb
    ),
    (
      'E.DIS Netz GmbH', 'edis-netzanschluss-public-2026', 'generation-monitor',
      'E.DIS Netzanschlussmonitor',
      'https://netzanschlussmonitor.e-dis-netz.de/',
      'connection_map', 'none', 'public_map',
      'Generation-oriented load-flow suggestion; it may not be the statutory connection point and does not publish large-load demand headroom.',
      'monthly', '{"scope":"generation_medium_voltage"}'::jsonb
    ),
    (
      'E.DIS Netz GmbH', 'edis-netzanschluss-public-2026', 'high-voltage-demand',
      'E.DIS high-voltage commercial and industrial connection',
      'https://www.e-dis-netz.de/de/energie-anschliessen/gewerbe-und-Industrie/netzanschluss-strom/stromanschluss-in-hochspannung.html',
      'connection_process', 'context_only', 'public_page',
      'Application guidance only; feasibility, capacity, cost, responsibility, and dates require an operator response.',
      'monthly', '{}'::jsonb
    )
) as v(operator_name, source_id, endpoint_key, title, endpoint_url, source_kind,
       demand_relevance, access_mode, legal_boundary, refresh_cadence, metadata)
join public.grid_operators o on o.canonical_name = v.operator_name
on conflict (operator_id, endpoint_key) do update set
  endpoint_url = excluded.endpoint_url,
  legal_boundary = excluded.legal_boundary,
  metadata = excluded.metadata,
  last_checked_at = excluded.last_checked_at,
  updated_at = now();

insert into public.operator_evidence_documents (
  endpoint_id, document_key, title, document_url, evidence_type, assessed_at,
  extracted_facts, caveats, retrieved_at
)
select e.id, 'capacity-map-2026-03-31', '50Hertz indicative connection-capacity map',
       e.endpoint_url, 'capacity_map', date '2026-03-31',
       '{"value_semantics":"maximum_available_connection_power","direction":"demand","binding":false}'::jsonb,
       array[
         'Non-binding orientation only',
         'Exact connection capacity requires project-specific composition and location',
         'No capacity value is imported until node identity and reuse rights are verified'
       ],
       now()
from public.operator_source_endpoints e
where e.endpoint_key = 'demand-capacity-map'
on conflict (endpoint_id, document_key) do update set
  assessed_at = excluded.assessed_at,
  extracted_facts = excluded.extracted_facts,
  caveats = excluded.caveats,
  retrieved_at = excluded.retrieved_at,
  updated_at = now();

insert into public.operator_evidence_documents (
  endpoint_id, document_key, title, document_url, evidence_type,
  extracted_facts, caveats, retrieved_at
)
select e.id, 'public-monitor-current', e.title, e.endpoint_url, 'portal_description',
       '{"direction":"generation","voltage_scope":"medium_voltage","demand_capacity_published":false}'::jsonb,
       array[
         'Suggested connection point may differ from the statutory connection point',
         'Not evidence of demand headroom'
       ],
       now()
from public.operator_source_endpoints e
where e.endpoint_key = 'generation-monitor'
on conflict (endpoint_id, document_key) do update set
  extracted_facts = excluded.extracted_facts,
  caveats = excluded.caveats,
  retrieved_at = excluded.retrieved_at,
  updated_at = now();

-- Normalize confidently attributable mapped operator labels. This does not confirm node identity
-- or capacity; it only attaches the operator directory record.
update public.canonical_grid_nodes n
set operator_id = o.id
from public.grid_operators o
where n.operator_id is null
  and o.canonical_name = 'E.DIS Netz GmbH'
  and lower(coalesce(n.operator_name, '')) in ('e.dis','e.dis netz','e.dis netz gmbh','edis');

create or replace function public.power_finder_operator_evidence(feature_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with node as (
    select n.id, n.operator_id, n.canonical_name
    from public.canonical_grid_nodes n
    where n.source_record_id = feature_id
    order by n.last_seen_at desc
    limit 1
  ),
  direct_items as (
    select jsonb_build_object(
      'scope', 'node_match',
      'status', m.status,
      'confidence', m.confidence,
      'rationale', m.rationale,
      'title', coalesce(d.title, p.project_name),
      'url', coalesce(d.document_url, p.source_url),
      'evidence_type', coalesce(d.evidence_type, p.project_type),
      'evidence_status', coalesce(d.evidence_status, p.evidence_status),
      'caveats', coalesce(to_jsonb(d.caveats), '[]'::jsonb),
      'project_status', p.project_status,
      'expected_service_date', p.expected_service_date
    ) as item
    from node n
    join public.operator_node_evidence_matches m on m.node_id = n.id and m.status = 'accepted'
    left join public.operator_evidence_documents d on d.id = m.evidence_document_id
    left join public.operator_grid_projects p on p.id = m.grid_project_id
  ),
  operator_items as (
    select jsonb_build_object(
      'scope', 'operator',
      'title', e.title,
      'url', e.endpoint_url,
      'source_kind', e.source_kind,
      'demand_relevance', e.demand_relevance,
      'access_mode', e.access_mode,
      'legal_boundary', e.legal_boundary,
      'last_checked_at', e.last_checked_at
    ) as item
    from node n
    join public.operator_source_endpoints e on e.operator_id = n.operator_id and e.active
  )
  select jsonb_build_object(
    'feature_id', feature_id,
    'node_name', (select canonical_name from node),
    'match_state', case when exists(select 1 from direct_items) then 'accepted_node_evidence'
                        when exists(select 1 from operator_items) then 'operator_context_only'
                        else 'no_operator_evidence' end,
    'items', coalesce(
      (select jsonb_agg(item) from (
        select item from direct_items
        union all
        select item from operator_items
      ) all_items),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.power_finder_operator_evidence(text) from public, anon;
grant execute on function public.power_finder_operator_evidence(text) to authenticated;

comment on table public.operator_evidence_documents is
  'Versioned official-public evidence. Presence of a document does not establish project capacity.';
comment on table public.operator_node_evidence_matches is
  'Reviewed links between mapped nodes and operator evidence; proposed matches are never user-visible.';
