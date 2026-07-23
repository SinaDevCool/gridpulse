-- Connect public map screening to private, evidence-led project decisions.

create unique index power_finder_shortlists_user_feature_unique
  on public.power_finder_shortlists(user_id, source_feature_id);

create table public.project_connection_candidates (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  shortlist_id uuid references public.power_finder_shortlists(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_feature_id text not null,
  feature_kind text not null check (feature_kind in ('node','industrial_site')),
  candidate_name text not null,
  longitude double precision,
  latitude double precision,
  operator_name text,
  voltage_kv numeric,
  distance_km numeric check (distance_km is null or distance_km >= 0),
  evidence_class text not null default 'open_mapping',
  capacity_state text not null default 'not_established',
  context_score integer check (context_score is null or context_score between 0 and 100),
  status text not null default 'screening'
    check (status in ('screening','investigating','preferred','held','rejected')),
  selection_rationale text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, source_feature_id)
);

create index project_connection_candidates_site_idx
  on public.project_connection_candidates(site_id, status, created_at);
alter table public.project_connection_candidates enable row level security;
grant select, insert, update, delete on public.project_connection_candidates to authenticated;
create policy "participants read project connection candidates"
  on public.project_connection_candidates for select to authenticated
  using (public.can_read_assessment(site_id));
create policy "editors create project connection candidates"
  on public.project_connection_candidates for insert to authenticated
  with check (public.can_edit_assessment(site_id) and user_id = (select auth.uid()));
create policy "editors update project connection candidates"
  on public.project_connection_candidates for update to authenticated
  using (public.can_edit_assessment(site_id))
  with check (public.can_edit_assessment(site_id));
create policy "editors delete project connection candidates"
  on public.project_connection_candidates for delete to authenticated
  using (public.can_edit_assessment(site_id));
create trigger project_connection_candidates_set_updated_at
before update on public.project_connection_candidates
for each row execute function public.set_updated_at();

create or replace function public.attach_shortlist_candidate(
  p_site_id uuid,
  p_shortlist_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.power_finder_shortlists%rowtype;
  feature jsonb;
  properties jsonb;
  coordinates jsonb;
  candidate_id uuid;
begin
  if not public.can_edit_assessment(p_site_id) then raise exception 'Editor access required.'; end if;
  select * into item from public.power_finder_shortlists
  where id = p_shortlist_id and user_id = (select auth.uid());
  if not found then raise exception 'Shortlist candidate not found.'; end if;
  feature := item.decision_snapshot->'feature';
  properties := coalesce(feature->'properties','{}'::jsonb);
  coordinates := feature->'geometry'->'coordinates';
  if coalesce(item.feature_kind,properties->>'kind') not in ('node','industrial_site') then
    raise exception 'Only grid nodes and industrial sites can be attached.';
  end if;

  if item.assessment_site_id is not null and item.assessment_site_id <> p_site_id then
    raise exception 'This shortlist item is already attached to another project.';
  end if;

  insert into public.project_connection_candidates (
    site_id,shortlist_id,user_id,source_feature_id,feature_kind,candidate_name,
    longitude,latitude,operator_name,voltage_kv,distance_km,evidence_class,
    capacity_state,context_score,source_snapshot
  ) values (
    p_site_id,item.id,(select auth.uid()),item.source_feature_id,
    coalesce(item.feature_kind,properties->>'kind'),item.title,
    nullif(coordinates->>0,'')::double precision,
    nullif(coordinates->>1,'')::double precision,
    nullif(properties->>'operator',''),
    (select max(value::numeric) from jsonb_array_elements_text(
      case when jsonb_typeof(properties->'voltage_kv')='array'
        then properties->'voltage_kv' else '[]'::jsonb end
    ) value),
    nullif(properties->>'distance_km','')::numeric,
    coalesce(nullif(properties->>'evidence_class',''),'open_mapping'),
    coalesce(nullif(properties->>'capacity_state',''),'not_established'),
    nullif(item.decision_snapshot->'score'->>'score','')::integer,
    item.decision_snapshot
  )
  on conflict (site_id,source_feature_id) do update set
    shortlist_id=excluded.shortlist_id, source_snapshot=excluded.source_snapshot,
    updated_at=now()
  returning id into candidate_id;

  update public.power_finder_shortlists
  set assessment_site_id=p_site_id,status='investigating',updated_at=now()
  where id=item.id;
  return candidate_id;
end;
$$;

revoke all on function public.attach_shortlist_candidate(uuid,uuid) from public, anon;
grant execute on function public.attach_shortlist_candidate(uuid,uuid) to authenticated;

create or replace function public.set_preferred_connection_candidate(
  p_candidate_id uuid,
  p_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.project_connection_candidates%rowtype;
begin
  select * into selected from public.project_connection_candidates where id=p_candidate_id;
  if not found or not public.can_edit_assessment(selected.site_id) then
    raise exception 'Editor access required.';
  end if;
  if char_length(trim(p_rationale)) < 10 then
    raise exception 'Selection rationale must contain at least 10 characters.';
  end if;
  update public.project_connection_candidates
    set status=case when id=p_candidate_id then 'preferred'
      when status='preferred' then 'held' else status end,
      selection_rationale=case when id=p_candidate_id then trim(p_rationale)
        else selection_rationale end
  where site_id=selected.site_id;
  return p_candidate_id;
end;
$$;

revoke all on function public.set_preferred_connection_candidate(uuid,text) from public, anon;
grant execute on function public.set_preferred_connection_candidate(uuid,text) to authenticated;

comment on table public.project_connection_candidates is
  'Saved map context compared inside a project. Context score is evidence completeness, never connection probability.';
