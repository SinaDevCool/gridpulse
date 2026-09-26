create table if not exists public.c3_security_flexibility_runs (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  model_version text not null,
  validation_class text not null check (validation_class in (
    'synthetic_demonstration','operator_model_unvalidated','operator_model_reconciled',
    'operator_reviewed','operator_confirmed'
  )),
  limits_sha256 text not null,
  node_record_id text,
  security jsonb not null,
  flexibility_summary jsonb not null,
  hourly_dispatch jsonb not null default '[]'::jsonb,
  fca_proposals jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(model_key, model_version, limits_sha256)
);

alter table public.c3_security_flexibility_runs enable row level security;
revoke all on public.c3_security_flexibility_runs from anon, authenticated;

create or replace function public.power_finder_public_c3_assessment(node_record_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with selected as (
    select r.*
    from public.c3_security_flexibility_runs r
    where
      (node_record_id is null and r.validation_class = 'synthetic_demonstration')
      or
      (node_record_id is not null and r.node_record_id = node_record_id
       and r.validation_class in ('operator_reviewed','operator_confirmed'))
    order by r.completed_at desc
    limit 1
  )
  select case when exists(select 1 from selected) then
    (select jsonb_build_object(
      'available', true,
      'runId', id,
      'validationClass', validation_class,
      'representation', case when validation_class = 'synthetic_demonstration'
        then 'benchmark_only_not_mapped_node_capacity' else 'operator_reviewed' end,
      'security', security,
      'flexibilitySummary', flexibility_summary,
      'fca', fca_proposals,
      'sources', sources,
      'limitations', limitations,
      'completedAt', completed_at
    ) from selected)
  else jsonb_build_object(
    'available', false,
    'validationClass', 'public_screening',
    'representation', 'no_operator_reviewed_security_or_flexibility_assessment',
    'message', 'No operator-reviewed C3 assessment exists for this mapped node.'
  ) end;
$$;

revoke all on function public.power_finder_public_c3_assessment(text) from public;
grant execute on function public.power_finder_public_c3_assessment(text) to anon, authenticated;
