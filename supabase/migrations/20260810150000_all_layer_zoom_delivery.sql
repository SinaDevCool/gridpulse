-- Extend scalable tile delivery to every public layer with deliberate zoom
-- thresholds. Detailed industrial polygons remain hidden at country scale.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef(
    'public.power_finder_public_tile(integer,integer,integer,boolean,boolean)'::regprocedure
  ) into definition;
  updated := regexp_replace(definition, 'z >= 11', 'z >= 7', 'gi');
  updated := regexp_replace(updated, 'z >= 8 AND a.location_precision', 'z >= 6 AND a.location_precision', 'gi');
  if updated = definition then raise exception 'tile layer thresholds update failed'; end if;
  execute updated;
end;
$$;
