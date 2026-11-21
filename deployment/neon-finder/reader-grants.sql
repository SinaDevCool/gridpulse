-- Credential creation is separate; apply only to this dedicated Neon staging DB.
alter role gridpulse_finder_reader nocreatedb nocreaterole noinherit;
alter role gridpulse_finder_reader set default_transaction_read_only=on;
alter role gridpulse_finder_reader set statement_timeout='8s';
grant connect on database gridpulse to gridpulse_finder_reader;
grant usage on schema finder_public,public to gridpulse_finder_reader;
grant select on finder_public.active_snapshot,finder_public.snapshots to gridpulse_finder_reader;
revoke all on finder_public.features,finder_public.registry_overview,finder_public.operational_status
 from gridpulse_finder_reader;
revoke all on finder_public.batches from gridpulse_finder_reader;
alter default privileges for role gridpulse_owner in schema finder_public
 revoke select on tables from gridpulse_finder_reader;

alter table finder_public.snapshots enable row level security;
alter table finder_public.features enable row level security;
alter table finder_public.registry_overview enable row level security;
alter table finder_public.operational_status enable row level security;
create policy reader_active_snapshot on finder_public.snapshots for select to gridpulse_finder_reader
 using (id=(select snapshot_id from finder_public.active_snapshot));
create policy reader_active_features on finder_public.features for select to gridpulse_finder_reader
 using (snapshot_id=(select snapshot_id from finder_public.active_snapshot));
create policy reader_active_overview on finder_public.registry_overview for select to gridpulse_finder_reader
 using (snapshot_id=(select snapshot_id from finder_public.active_snapshot));
create policy reader_active_status on finder_public.operational_status for select to gridpulse_finder_reader
 using (snapshot_id=(select snapshot_id from finder_public.active_snapshot));
grant execute on function finder_public.viewport(double precision,double precision,double precision,double precision,boolean,boolean,boolean),
 finder_public.tile(integer,integer,integer,boolean,boolean,boolean),
 finder_public.coverage(),finder_public.operators(),finder_public.study(text)
 to gridpulse_finder_reader;
