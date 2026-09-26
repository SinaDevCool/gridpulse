create or replace function public.power_finder_public_operators()
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
  with operators as (
    select trim(operator_name) as name, count(*)::integer as feature_count
    from (
      select operator_name from public.canonical_grid_nodes
      union all
      select operator_name from public.canonical_grid_lines
    ) source
    where operator_name is not null and trim(operator_name) <> ''
    group by trim(operator_name)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', name,
    'type', case
      when lower(name) similar to '%(50hertz|amprion|tennet|transnetbw)%' then 'TSO'
      else 'DSO / other'
    end,
    'featureCount', feature_count
  ) order by
    case when lower(name) similar to '%(50hertz|amprion|tennet|transnetbw)%' then 0 else 1 end,
    name), '[]'::jsonb)
  from operators
$$;

revoke all on function public.power_finder_public_operators() from public, anon, authenticated;
grant execute on function public.power_finder_public_operators() to anon, authenticated;
