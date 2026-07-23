-- Preserve decision-critical topology when dense MaStR point layers reach the
-- bounded viewport limit. Optional asset context is lower priority than lines.

do $$
declare
  definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.power_finder_viewport(double precision,double precision,double precision,double precision,integer)'::regprocedure
  ) into definition;

  updated_definition := replace(
    definition,
    E'when ''node'' then 1\n        when ''industrial_site'' then 2\n        when ''generation_asset'' then 3\n        when ''storage_asset'' then 4\n        else 5',
    E'when ''node'' then 1\n        when ''line'' then 2\n        when ''industrial_site'' then 3\n        when ''generation_asset'' then 4\n        when ''storage_asset'' then 5\n        else 6'
  );

  if updated_definition = definition then
    raise exception 'Power Finder viewport definition did not match expected feature priority';
  end if;

  execute updated_definition;
end;
$$;
