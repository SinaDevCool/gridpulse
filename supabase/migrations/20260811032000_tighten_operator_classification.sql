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
    'type', case
      when lower(name) ~ '^(50hertz( transmission( gmbh)?)?|amprion( gmbh)?|tennet( tso)?( gmbh)?|transnetbw( gmbh)?)$'
        then 'TSO'
      else 'DSO / other'
    end,
    'featureCount', feature_count
  ) order by
    case when lower(name) ~ '^(50hertz( transmission( gmbh)?)?|amprion( gmbh)?|tennet( tso)?( gmbh)?|transnetbw( gmbh)?)$'
      then 0 else 1 end,
    name), '[]'::jsonb)
  from public.power_finder_grid_operator_catalog
$$;

revoke all on function public.power_finder_public_operators() from public, anon, authenticated;
grant execute on function public.power_finder_public_operators() to anon, authenticated;
