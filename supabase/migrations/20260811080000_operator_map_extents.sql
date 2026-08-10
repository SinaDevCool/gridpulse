drop function if exists public.power_finder_public_operators();
drop materialized view if exists public.power_finder_grid_operator_catalog;

create materialized view public.power_finder_grid_operator_catalog as
with operator_features as (
  select trim(operator_name) as name, geometry
  from public.canonical_grid_nodes
  where operator_name is not null and trim(operator_name) <> ''
  union all
  select trim(operator_name) as name, geometry
  from public.canonical_grid_lines
  where operator_name is not null and trim(operator_name) <> ''
), operator_extents as (
  select
    name,
    count(*)::integer as feature_count,
    extensions.st_extent(geometry) as extent
  from operator_features
  group by name
)
select
  name,
  case
    when lower(name) ~ '^(50hertz( transmission( gmbh)?)?|amprion( gmbh)?|tennet( tso)?( gmbh)?|transnetbw( gmbh)?)$'
      then 'TSO'
    else 'DSO / other'
  end as type,
  feature_count,
  array[
    extensions.st_xmin(extent)::double precision,
    extensions.st_ymin(extent)::double precision,
    extensions.st_xmax(extent)::double precision,
    extensions.st_ymax(extent)::double precision
  ] as bounds
from operator_extents;

create unique index power_finder_grid_operator_catalog_name_idx
  on public.power_finder_grid_operator_catalog (name);

revoke all on public.power_finder_grid_operator_catalog from public, anon, authenticated;

create or replace function public.power_finder_public_operators()
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', name,
    'type', type,
    'featureCount', feature_count,
    'bounds', bounds
  ) order by case when type = 'TSO' then 0 else 1 end, name), '[]'::jsonb)
  from public.power_finder_grid_operator_catalog
$$;

revoke all on function public.power_finder_public_operators() from public, anon, authenticated;
grant execute on function public.power_finder_public_operators() to anon, authenticated;

comment on materialized view public.power_finder_grid_operator_catalog is
  'Accepted mapped operator catalog with geographic extents; refresh after national topology imports.';
