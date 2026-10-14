-- Minimal stand-ins for what a Supabase project provides, so migrations run on plain Postgres in tests.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean);
-- (search_path set per session)
-- search_path = "$user", public, extensions;
set search_path = "$user", public, extensions;
