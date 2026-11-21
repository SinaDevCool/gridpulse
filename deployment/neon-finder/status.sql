-- Lossless normalized status supplement. Unlisted admitted records are operational;
-- industrial sites retain the source RPC's explicit unknown status.
create table if not exists finder_public.operational_status (
 snapshot_id text not null,
 kind text not null,
 id text not null,
 status text not null check(status in ('construction','planned','out_of_service')),
 primary key(snapshot_id,kind,id),
 foreign key(snapshot_id,kind,id) references finder_public.features(snapshot_id,kind,id)
);
revoke all on finder_public.operational_status from public;
create or replace function finder_public.import_status(s text,payload text,h text)
returns bigint language plpgsql set search_path='' as $$
declare n bigint;
begin
 if not exists(select 1 from finder_public.snapshots where id=s and activated_at is null)
 then raise exception 'Snapshot absent or immutable'; end if;
 if encode(sha256(convert_to(payload,'UTF8')),'hex')<>h
 or jsonb_array_length(payload::jsonb)<>23445 then raise exception 'Status supplement mismatch'; end if;
 if exists(select 1 from finder_public.operational_status where snapshot_id=s) then
   if (select extras->>'status_sha256' from finder_public.snapshots where id=s)=h
   then return 23445; else raise exception 'Status supplement already exists'; end if;
 end if;
 insert into finder_public.operational_status
 select s,x.kind,x.id,x.status from jsonb_to_recordset(payload::jsonb) x(kind text,id text,status text);
 get diagnostics n=row_count;
 update finder_public.snapshots set extras=extras||jsonb_build_object('status_sha256',h) where id=s;
 return n;
end $$;
revoke all on function finder_public.import_status(text,text,text) from public;
