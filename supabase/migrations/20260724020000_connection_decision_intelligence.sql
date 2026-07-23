-- Portfolio decision intelligence and explicit source-reuse governance.

create table public.operator_data_reuse_authorizations (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.grid_sources(id) on delete cascade,
  operator_id uuid references public.grid_operators(id) on delete set null,
  dataset_key text not null,
  status text not null
    check (status in ('awaiting_permission','metadata_only','permitted','denied','expired')),
  reuse_basis text,
  permitted_uses text[] not null default '{}',
  prohibited_uses text[] not null default '{}',
  evidence_url text,
  evidence_document_id uuid references public.operator_evidence_documents(id) on delete set null,
  valid_from date,
  valid_to date,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, dataset_key),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  check (status <> 'permitted' or (reuse_basis is not null and evidence_url is not null))
);

alter table public.operator_data_reuse_authorizations enable row level security;
grant select on public.operator_data_reuse_authorizations to authenticated;
create policy "authenticated users read operator reuse gates"
  on public.operator_data_reuse_authorizations for select to authenticated using (true);

create trigger operator_data_reuse_authorizations_set_updated_at
before update on public.operator_data_reuse_authorizations
for each row execute function public.set_updated_at();

insert into public.operator_data_reuse_authorizations (
  source_id, operator_id, dataset_key, status, permitted_uses, prohibited_uses,
  evidence_url, notes
)
select
  '50hertz-netzanschluss-2026', o.id, 'netzkapazitaet-production-map',
  'awaiting_permission', array['source-linking','metadata','change-detection'],
  array['bulk-record-republication','numeric-capacity-republication'],
  'https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss',
  'The public map is useful evidence, but GridPulse has not documented a licence or written permission for bulk record republication. Import remains blocked.'
from public.grid_operators o
where o.canonical_name = '50Hertz Transmission GmbH'
on conflict (source_id, dataset_key) do update set
  status = excluded.status,
  permitted_uses = excluded.permitted_uses,
  prohibited_uses = excluded.prohibited_uses,
  evidence_url = excluded.evidence_url,
  notes = excluded.notes,
  updated_at = now();

create or replace function public.connection_decision_portfolio()
returns table (
  site_id uuid,
  site_name text,
  project_type text,
  requested_import_mw numeric,
  minimum_viable_import_mw numeric,
  target_voltage_kv numeric,
  target_energization_date date,
  operator_name text,
  engagement_status text,
  evidence_state text,
  indicated_import_mw numeric,
  reinforcement_required boolean,
  reinforcement_summary text,
  estimated_connection_cost_eur numeric,
  indicated_connection_date date,
  response_due_at timestamptz,
  offer_expires_at timestamptz,
  reservation_expires_at timestamptz,
  evidence_score integer,
  evidence_label text,
  missing_evidence text[],
  next_deadline timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with accessible_sites as (
    select s.*
    from public.candidate_sites s
    where s.assessment_status <> 'archived'
      and public.can_read_assessment(s.id)
  ),
  latest_engagement as (
    select distinct on (e.site_id) e.*
    from public.operator_engagements e
    join accessible_sites s on s.id = e.site_id
    order by e.site_id, e.updated_at desc
  ),
  aggregates as (
    select
      s.id as site_id,
      count(distinct d.id) as document_count,
      count(distinct d.id) filter (where d.source_classification = 'operator_source')
        as operator_document_count,
      count(distinct r.id) as requirement_count,
      count(distinct r.id) filter (
        where r.status in ('ready','submitted','accepted','not_applicable')
      ) as requirement_ready_count,
      count(distinct p.id) as profile_count,
      count(distinct sp.id) filter (where sp.status = 'approved_for_operator')
        as approved_package_count,
      count(distinct od.id) filter (where od.decision = 'confirmed')
        as confirmed_decision_count
    from accessible_sites s
    left join public.assessment_documents d on d.site_id = s.id
    left join public.operator_requirements r on r.site_id = s.id
    left join public.interval_profiles p on p.site_id = s.id
    left join public.submission_packages sp on sp.site_id = s.id
    left join public.operator_decisions od on od.site_id = s.id
    group by s.id
  ),
  scored as (
    select
      s.*, e.status as engagement_status, e.evidence_state, e.indicated_import_mw,
      e.reinforcement_required, e.reinforcement_summary,
      e.estimated_connection_cost_eur, e.indicated_connection_date,
      e.response_due_at, e.offer_expires_at, e.reservation_expires_at,
      (
        case when s.requested_import_mw > 0 then 10 else 0 end
        + case when s.target_voltage_kv is not null then 8 else 0 end
        + case when s.responsible_operator_name is not null then 12 else 0 end
        + case when a.profile_count > 0 then 10 else 0 end
        + case when a.requirement_count > 0
          then round(20.0 * a.requirement_ready_count / a.requirement_count)::integer else 0 end
        + case when a.document_count > 0 then 10 else 0 end
        + case when a.approved_package_count > 0 then 10 else 0 end
        + case when e.status in (
          'submitted','acknowledged','under_review','information_requested',
          'response_received','offer_received','reserved'
        ) then 10 else 0 end
        + case when a.operator_document_count > 0 then 5 else 0 end
        + case when a.confirmed_decision_count > 0 then 5 else 0 end
      )::integer as score,
      array_remove(array[
        case when s.target_voltage_kv is null then 'Target voltage not established' end,
        case when s.responsible_operator_name is null then 'Responsible operator not confirmed' end,
        case when a.profile_count = 0 then 'Interval load profile missing' end,
        case when a.requirement_count = 0 or a.requirement_ready_count < a.requirement_count
          then 'Operator application checklist incomplete' end,
        case when a.document_count = 0 then 'Supporting documents missing' end,
        case when a.approved_package_count = 0 then 'No package approved for operator' end,
        case when e.id is null then 'No controlled operator engagement' end,
        case when a.operator_document_count = 0 then 'No written operator response' end,
        case when a.confirmed_decision_count = 0 then 'No signed operator confirmation' end
      ], null) as gaps
    from accessible_sites s
    join aggregates a on a.site_id = s.id
    left join latest_engagement e on e.site_id = s.id
  )
  select
    s.id, s.name, s.project_type, s.requested_import_mw,
    s.minimum_viable_import_mw, s.target_voltage_kv, s.target_energization_date,
    coalesce(s.responsible_operator_name, s.likely_network_operator),
    coalesce(s.engagement_status, 'not_started'), coalesce(s.evidence_state, 'customer_declared'),
    s.indicated_import_mw, s.reinforcement_required, s.reinforcement_summary,
    s.estimated_connection_cost_eur, s.indicated_connection_date,
    s.response_due_at, s.offer_expires_at, s.reservation_expires_at,
    least(s.score, 100),
    case
      when s.score >= 85 then 'decision evidence strong'
      when s.score >= 65 then 'operator engagement ready'
      when s.score >= 40 then 'evidence developing'
      else 'limited evidence'
    end,
    s.gaps,
    (
      select min(deadline)
      from unnest(array[s.response_due_at,s.offer_expires_at,s.reservation_expires_at]) deadline
      where deadline is not null
    )
  from scored s
  order by s.score desc, s.name;
$$;

revoke all on function public.connection_decision_portfolio() from public, anon;
grant execute on function public.connection_decision_portfolio() to authenticated;

create or replace function public.connection_decision_alerts()
returns table (
  alert_key text,
  site_id uuid,
  severity text,
  alert_type text,
  title text,
  detail text,
  due_at timestamptz,
  action_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  with engagements as (
    select e.*, s.name as site_name
    from public.operator_engagements e
    join public.candidate_sites s on s.id = e.site_id
    where public.can_read_assessment(e.site_id)
  ),
  deadline_alerts as (
    select
      'response:' || e.id as alert_key, e.site_id,
      case when e.response_due_at < now() then 'critical' else 'warning' end as severity,
      'operator_response_due' as alert_type,
      case when e.response_due_at < now() then 'Operator response overdue'
        else 'Operator response due soon' end as title,
      e.site_name || ' · ' || e.recipient_organization as detail,
      e.response_due_at as due_at, '/assessments/' || e.site_id as action_path
    from engagements e
    where e.response_due_at is not null
      and e.status not in ('response_received','offer_received','reserved','declined','withdrawn','closed')
      and e.response_due_at <= now() + interval '14 days'

    union all

    select
      'offer:' || e.id, e.site_id,
      case when e.offer_expires_at < now() + interval '3 days' then 'critical' else 'warning' end,
      'offer_expiry', 'Connection offer expiring',
      e.site_name || ' · preserve decision and next action',
      e.offer_expires_at, '/assessments/' || e.site_id
    from engagements e
    where e.offer_expires_at is not null
      and e.status not in ('declined','withdrawn','expired','closed')
      and e.offer_expires_at <= now() + interval '30 days'

    union all

    select
      'reservation:' || e.id, e.site_id,
      case when e.reservation_expires_at < now() + interval '3 days' then 'critical' else 'warning' end,
      'reservation_expiry', 'Capacity reservation expiring',
      e.site_name || ' · verify conditions before relying on the reservation',
      e.reservation_expires_at, '/assessments/' || e.site_id
    from engagements e
    where e.reservation_expires_at is not null
      and e.status not in ('declined','withdrawn','expired','closed')
      and e.reservation_expires_at <= now() + interval '30 days'
  ),
  source_alerts as (
    select
      'source:' || e.id as alert_key, null::uuid as site_id, 'info' as severity,
      'operator_source_changed' as alert_type,
      'Operator source changed: ' || e.title as title,
      'Review the changed publication before relying on prior screening evidence.' as detail,
      e.last_changed_at as due_at, '/evidence-review' as action_path
    from public.operator_source_endpoints e
    where e.active and e.last_changed_at >= now() - interval '14 days'
      and public.is_operator_evidence_reviewer()
  )
  select combined.*
  from (
    select * from deadline_alerts
    union all
    select * from source_alerts
  ) combined
  order by
    case combined.severity when 'critical' then 1 when 'warning' then 2 else 3 end,
    combined.due_at nulls last;
$$;

revoke all on function public.connection_decision_alerts() from public, anon;
grant execute on function public.connection_decision_alerts() to authenticated;

comment on function public.connection_decision_portfolio() is
  'Evidence-completeness comparison, not a probability of connection or operator capacity claim.';
