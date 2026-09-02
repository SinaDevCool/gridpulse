-- Explicitly reconcile a public Power Finder candidate to a private operator-model bus.
-- Geographic proximity can propose a link but can never accept one.
create table if not exists public.grid_candidate_model_bus_links (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.candidate_sites(id) on delete cascade,
  workspace_id uuid not null references public.operator_pilot_workspaces(id) on delete cascade,
  public_candidate_id text not null,
  public_node_id text,
  model_id text not null,
  model_version text not null,
  operator_bus_id text not null,
  match_method text not null check (match_method in ('manual','identifier','assisted_geographic','operator_supplied')),
  match_status text not null default 'suggested' check (match_status in ('suggested','under_review','accepted','rejected','superseded')),
  distance_m numeric check (distance_m is null or distance_m >= 0),
  voltage_match boolean,
  operator_match boolean,
  evidence_reference text,
  review_note text,
  reconciliation_sha256 text not null check (reconciliation_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid not null default auth.uid() references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, model_id, model_version, public_candidate_id, operator_bus_id, reconciliation_sha256),
  check ((match_status = 'accepted') = (reviewed_by is not null and reviewed_at is not null))
);

create unique index if not exists grid_candidate_model_bus_links_one_active
  on public.grid_candidate_model_bus_links(site_id, model_id, model_version)
  where match_status = 'accepted';

alter table public.grid_candidate_model_bus_links enable row level security;
revoke all on public.grid_candidate_model_bus_links from public, anon;
grant select, insert, update on public.grid_candidate_model_bus_links to authenticated;

create policy "participants read candidate model links"
  on public.grid_candidate_model_bus_links for select to authenticated
  using (public.can_read_assessment(site_id));

create policy "graph reviewers create candidate model links"
  on public.grid_candidate_model_bus_links for insert to authenticated
  with check (
    public.get_assessment_role(site_id) in ('technical_reviewer','grid_expert','operator_reviewer','workspace_admin')
    and created_by = auth.uid()
  );

create policy "graph reviewers update candidate model links"
  on public.grid_candidate_model_bus_links for update to authenticated
  using (public.get_assessment_role(site_id) in ('grid_expert','operator_reviewer','workspace_admin'))
  with check (public.get_assessment_role(site_id) in ('grid_expert','operator_reviewer','workspace_admin'));

create or replace function public.accept_candidate_model_bus_link(
  p_link_id uuid,
  p_review_note text default null
) returns public.grid_candidate_model_bus_links
language plpgsql security definer set search_path=''
as $$
declare link public.grid_candidate_model_bus_links%rowtype;
begin
  select * into link from public.grid_candidate_model_bus_links where id = p_link_id for update;
  if not found or public.get_assessment_role(link.site_id) not in ('grid_expert','operator_reviewer','workspace_admin') then
    raise exception 'Graph reviewer access required';
  end if;
  update public.grid_candidate_model_bus_links
    set match_status='superseded', superseded_at=now(), updated_at=now()
    where site_id=link.site_id and model_id=link.model_id and model_version=link.model_version
      and match_status='accepted' and id<>link.id;
  update public.grid_candidate_model_bus_links
    set match_status='accepted', reviewed_by=auth.uid(), reviewed_at=now(),
        review_note=p_review_note, updated_at=now()
    where id=link.id returning * into link;
  return link;
end $$;

revoke all on function public.accept_candidate_model_bus_link(uuid,text) from public, anon;
grant execute on function public.accept_candidate_model_bus_link(uuid,text) to authenticated;
