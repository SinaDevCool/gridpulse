-- One-time production data retirement; not part of the replayable schema migrations.
-- Project: csdsquchhhwvvtleiyuy; verified source archive: supabase-cleanup-20261122.
-- Archive manifest SHA256: 908471562ca7b927b0a1fd98fc80527d6d00c3b5947a87a8e0c628fc1e6bbdc3.
-- All 32 source/backup UUID ranges matched before this operation.
set local lock_timeout = '3s';
set local statement_timeout = '45s';
do $retire$
declare n bigint; version bigint;
begin
  lock table public.canonical_energy_assets, public.canonical_grid_lines in access exclusive mode;
  if exists(select 1 from pg_constraint where contype='f' and confrelid in ('public.canonical_energy_assets'::regclass,'public.canonical_grid_lines'::regclass)) then
    raise exception 'Unexpected inbound foreign key; abort retirement';
  end if;
  if exists(select 1 from pg_trigger where tgrelid in ('public.canonical_energy_assets'::regclass,'public.canonical_grid_lines'::regclass) and not tgisinternal and tgenabled<>'D') then
    raise exception 'Unexpected user trigger; abort retirement';
  end if;
  select count(*),max(xmin::text::bigint) into n,version from public.canonical_energy_assets;
  if n<>640724 or version is distinct from 4839::bigint then
    raise exception 'Energy asset source changed; abort retirement';
  end if;
  select count(*),max(xmin::text::bigint) into n,version from public.canonical_grid_lines;
  if n<>123974 or version is distinct from 4361::bigint then
    raise exception 'Grid line source changed; abort retirement';
  end if;
  truncate table public.canonical_energy_assets, public.canonical_grid_lines;
end
$retire$;
