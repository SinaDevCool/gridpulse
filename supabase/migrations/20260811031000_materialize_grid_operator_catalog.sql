create materialized view if not exists public.power_finder_grid_operator_catalog as
select
  trim(operator_name) as name,
  case
    when lower(trim(operator_name)) similar to '%(50hertz|amprion|tennet|transnetbw)%' then 'TSO'
    else 'DSO / other'
  end as type,
  count(*)::integer as feature_count
from (
  select operator_name from public.canonical_grid_nodes
  union all
  select operator_name from public.canonical_grid_lines
) source
where operator_name is not null and trim(operator_name) <> ''
group by trim(operator_name);

create unique index if not exists power_finder_grid_operator_catalog_name_idx
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
    'featureCount', feature_count
  ) order by case when type = 'TSO' then 0 else 1 end, name), '[]'::jsonb)
  from public.power_finder_grid_operator_catalog
$$;

revoke all on function public.power_finder_public_operators() from public, anon, authenticated;
grant execute on function public.power_finder_public_operators() to anon, authenticated;
