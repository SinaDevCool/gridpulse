create materialized view public.power_finder_dso_tso_context as
with catalog_centres as (
  select
    name,
    type,
    extensions.st_setsrid(
      extensions.st_makepoint((bounds[1] + bounds[3]) / 2, (bounds[2] + bounds[4]) / 2),
      4326
    ) as centre
  from public.power_finder_grid_operator_catalog
  where bounds is not null
), canonical_tso as (
  select
    case
      when lower(name) ~ '^50hertz' then '50Hertz Transmission GmbH'
      when lower(name) ~ '^amprion' then 'Amprion GmbH'
      when lower(name) ~ '^tennet' then 'TenneT TSO GmbH'
      when lower(name) ~ '^transnetbw' then 'TransnetBW GmbH'
    end as tso_name,
    extensions.st_centroid(extensions.st_collect(centre)) as centre
  from catalog_centres
  where type = 'TSO'
  group by 1
), ranked as (
  select
    dso.name as dso_name,
    tso.tso_name,
    row_number() over (
      partition by dso.name
      order by extensions.st_distance(dso.centre, tso.centre)
    ) as proximity_rank
  from catalog_centres dso
  cross join canonical_tso tso
  where dso.type = 'DSO / other'
)
select dso_name, tso_name, 'mapped_proximity'::text as relationship_basis
from ranked
where proximity_rank = 1;

create unique index power_finder_dso_tso_context_name_idx
  on public.power_finder_dso_tso_context (dso_name);

revoke all on public.power_finder_dso_tso_context from public, anon, authenticated;

create or replace function public.power_finder_public_operators()
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', catalog.name,
    'type', catalog.type,
    'featureCount', catalog.feature_count,
    'bounds', catalog.bounds,
    'tsoNames', case
      when catalog.type = 'TSO' then jsonb_build_array(
        case
          when lower(catalog.name) ~ '^50hertz' then '50Hertz Transmission GmbH'
          when lower(catalog.name) ~ '^amprion' then 'Amprion GmbH'
          when lower(catalog.name) ~ '^tennet' then 'TenneT TSO GmbH'
          when lower(catalog.name) ~ '^transnetbw' then 'TransnetBW GmbH'
        end
      )
      when context.tso_name is not null then jsonb_build_array(context.tso_name)
      else '[]'::jsonb
    end,
    'relationshipBasis', context.relationship_basis
  ) order by case when catalog.type = 'TSO' then 0 else 1 end, catalog.name), '[]'::jsonb)
  from public.power_finder_grid_operator_catalog catalog
  left join public.power_finder_dso_tso_context context on context.dso_name = catalog.name
$$;

revoke all on function public.power_finder_public_operators() from public, anon, authenticated;
grant execute on function public.power_finder_public_operators() to anon, authenticated;

comment on materialized view public.power_finder_dso_tso_context is
  'Screening-only DSO to nearest mapped TSO context; not an operator-confirmed control-area allocation.';
