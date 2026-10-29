-- Disposable CI database ONLY. These are platform shims, not production Auth.
create role anon;
create role authenticated;
create role service_role bypassrls;
create role authenticator;
create role supabase_auth_admin;
create schema auth;
create schema storage;
create schema if not exists extensions;
create table auth.users (
 id uuid primary key, email text, is_anonymous boolean default false,
 raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql as $$
 select current_setting('request.jwt.claim.role',true)
$$;
create function auth.jwt() returns jsonb language sql as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),name text,bucket_id text,owner uuid,owner_id text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
grant usage on schema auth,storage,public to anon,authenticated,service_role,supabase_auth_admin;
grant all on all tables in schema auth,storage to service_role;
-- The stock PostGIS CI image creates PostGIS in public; Supabase uses extensions.
-- This database has passed the empty-table guard. PostGIS is not relocatable.
drop extension postgis cascade;
create extension postgis with schema extensions;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
