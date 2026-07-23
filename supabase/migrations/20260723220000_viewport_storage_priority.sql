-- Storage is sparse and commercially important. Include it before filling the
-- remaining bounded viewport budget with denser generation points.

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
    E'when ''generation_asset'' then 4\n        when ''storage_asset'' then 5',
    E'when ''storage_asset'' then 4\n        when ''generation_asset'' then 5'
  );

  if updated_definition = definition then
    raise exception 'Power Finder viewport definition did not match expected asset priority';
  end if;

  execute updated_definition;
end;
$$;
