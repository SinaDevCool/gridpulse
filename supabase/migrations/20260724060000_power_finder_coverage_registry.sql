create table if not exists public.power_finder_region_coverage (
  region_code text primary key,
  region_name text not null,
  status text not null check (status in ('accepted', 'partial', 'planned', 'unavailable')),
  bounds jsonb not null check (jsonb_array_length(bounds) = 4),
  center_point jsonb not null check (jsonb_array_length(center_point) = 2),
  default_zoom numeric not null check (default_zoom between 3 and 14),
  topology boolean not null default false,
  registered_assets boolean not null default false,
  published_demand_capacity boolean not null default false,
  last_accepted_at timestamptz,
  evidence_boundary text not null,
  updated_at timestamptz not null default now()
);

alter table public.power_finder_region_coverage enable row level security;

revoke all on public.power_finder_region_coverage from anon, authenticated;

insert into public.power_finder_region_coverage (
  region_code,
  region_name,
  status,
  bounds,
  center_point,
  default_zoom,
  topology,
  registered_assets,
  published_demand_capacity,
  last_accepted_at,
  evidence_boundary
)
values
  (
    'DE',
    'Germany',
    'partial',
    '[5.866, 47.270, 15.042, 55.059]'::jsonb,
    '[10.45, 51.16]'::jsonb,
    5.4,
    false,
    false,
    false,
    null,
    'National ingestion is planned. Only accepted regional releases are displayed.'
  ),
  (
    'DE-BB',
    'Brandenburg',
    'accepted',
    '[11.27, 51.36, 14.77, 53.56]'::jsonb,
    '[13.36, 52.31]'::jsonb,
    8.2,
    true,
    true,
    false,
    '2026-07-23T00:00:00Z'::timestamptz,
    'Accepted OSM topology and MaStR asset context. Demand headroom is not established.'
  )
on conflict (region_code) do update set
  region_name = excluded.region_name,
  status = excluded.status,
  bounds = excluded.bounds,
  center_point = excluded.center_point,
  default_zoom = excluded.default_zoom,
  topology = excluded.topology,
  registered_assets = excluded.registered_assets,
  published_demand_capacity = excluded.published_demand_capacity,
  last_accepted_at = excluded.last_accepted_at,
  evidence_boundary = excluded.evidence_boundary,
  updated_at = now();

create or replace function public.power_finder_coverage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'region_code', region_code,
        'region_name', region_name,
        'status', status,
        'bounds', bounds,
        'center', center_point,
        'zoom', default_zoom,
        'topology', topology,
        'registered_assets', registered_assets,
        'published_demand_capacity', published_demand_capacity,
        'last_accepted_at', last_accepted_at,
        'evidence_boundary', evidence_boundary
      )
      order by case status when 'accepted' then 1 when 'partial' then 2 else 3 end, region_name
    ),
    '[]'::jsonb
  )
  from public.power_finder_region_coverage;
$$;

revoke all on function public.power_finder_coverage() from public, anon;
grant execute on function public.power_finder_coverage() to authenticated;

comment on table public.power_finder_region_coverage is
  'Explicit geographic and evidence coverage; planned regions never imply accepted map data.';
