-- READ ONLY. Run in the existing production project's SQL Editor.
-- Export the single result row as CSV and keep it private. No user rows,
-- passwords, JWT signing keys, API keys or Storage object bytes are selected.
-- Function definitions/comments may contain embedded application values;
-- review the export before sharing. This is an inventory, NOT a restore script.
select jsonb_build_object(
  'captured_at', current_timestamp,
  'database_version', current_setting('server_version'),
  'extensions', (select jsonb_agg(to_jsonb(e)) from (
    select e.extname, e.extversion, n.nspname as schema_name
    from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    order by e.extname
  ) e),
  'columns', (select jsonb_agg(to_jsonb(c)) from (
    select table_schema,table_name,column_name,ordinal_position,data_type,
      udt_schema,udt_name,is_nullable,column_default,is_identity,is_generated,generation_expression
    from information_schema.columns where table_schema='public'
    order by table_name,ordinal_position
  ) c),
  'relations', (select jsonb_agg(to_jsonb(r)) from (
    select c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
      pg_get_userbyid(c.relowner) as owner,c.relacl::text as acl,c.reloptions,
      case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,true) end as view_definition
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','S','f') order by c.relname
  ) r),
  'constraints', (select jsonb_agg(to_jsonb(c)) from (
    select t.relname as table_name,c.conname,pg_get_constraintdef(c.oid,true) as definition
    from pg_constraint c join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'
    order by t.relname,c.conname
  ) c),
  'indexes', (select jsonb_agg(to_jsonb(i)) from (
    select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname
  ) i),
  'functions', (select jsonb_agg(to_jsonb(f)) from (
    select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_functiondef(p.oid) as definition,pg_get_userbyid(p.proowner) as owner,
      p.proacl::text as acl,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p') order by p.proname,p.oid
  ) f),
  'triggers', (select jsonb_agg(to_jsonb(t)) from (
    select c.relname as table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true) as definition
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname
  ) t),
  'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname in ('public','storage')),
  'enums', (select jsonb_agg(to_jsonb(e)) from (
    select t.typname,e.enumlabel,e.enumsortorder from pg_enum e
    join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' order by t.typname,e.enumsortorder
  ) e),
  'schema_acl', (select jsonb_agg(to_jsonb(n)) from (
    select nspname,nspacl::text as acl from pg_namespace where nspname in ('public','auth','storage')
  ) n),
  'default_acl', (select jsonb_agg(to_jsonb(a)) from (
    select pg_get_userbyid(a.defaclrole) as owner,n.nspname,a.defaclobjtype,a.defaclacl::text as acl
    from pg_default_acl a left join pg_namespace n on n.oid=a.defaclnamespace
  ) a),
  'role_membership', (select jsonb_agg(to_jsonb(m)) from (
    select granted.rolname as granted_role,member.rolname as member
    from pg_auth_members m join pg_roles granted on granted.oid=m.roleid
    join pg_roles member on member.oid=m.member
    where member.rolname in ('anon','authenticated','service_role','authenticator','supabase_auth_admin','gridpulse_public_visitor')
    order by member.rolname,granted.rolname
  ) m),
  'buckets', (select jsonb_agg(to_jsonb(b)) from (
    select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id
  ) b)
) as production_schema_snapshot;
