import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const site = "11111111-1111-4111-8111-111111111111";
const first = "22222222-2222-4222-8222-222222222222";
const second = "33333333-3333-4333-8333-333333333333";
try {
  await db.exec(`create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function public.can_edit_assessment(uuid) returns boolean language sql as $$ select $1 = auth.uid() $$;
    create table connection_scenarios(id uuid primary key, site_id uuid, selection_status text, selection_rationale text);
    create unique index one_preferred on connection_scenarios(site_id) where selection_status='preferred';
    create table operator_packages(id uuid primary key, site_id uuid,user_id uuid,version integer,
      status text check(status in ('draft','internal_review','approved','issued')),snapshot jsonb,manifest jsonb,
      methodology_version text,input_manifest jsonb,issued_at timestamptz,created_at timestamptz,unique(site_id,version));
    create table interval_profiles(id uuid primary key, site_id uuid);
    create table flexibility_profiles(id uuid,site_id uuid,user_id uuid,name text,version integer,supersedes_id uuid,
      status text,created_at timestamptz,updated_at timestamptz,calculation_version text,profile_id uuid,unique(site_id,name,version));
    create table flexibility_simulations(id uuid,site_id uuid,profile_id uuid,scenario_id uuid,user_id uuid,version integer,
      settings jsonb,summary jsonb,timeline jsonb,calculation_version text,classification text,input_manifest jsonb,
      created_at timestamptz,unique(site_id,profile_id,version));
    create table connection_decisions(id uuid default gen_random_uuid(), site_id uuid, scenario_id uuid, package_id uuid,
      user_id uuid, version integer, status text, rationale text not null, alternatives_rejected jsonb,
      conditions_to_proceed jsonb, assumptions jsonb, evidence_ids uuid[], unique(site_id,version));
    create table assessment_milestones(site_id uuid,user_id uuid,title text not null,milestone_type text,status text,due_at timestamptz,notes text);
    create table assessment_activity(site_id uuid,actor_id uuid,event_type text,entity_type text,entity_id uuid,summary text,details jsonb);
    grant usage on schema public,auth to authenticated;
    grant select,insert,update on all tables in schema public to authenticated;`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261012190000_atomic_strategy_commands.sql", import.meta.url), "utf8"));
  await db.query("insert into connection_scenarios values($1,$3,'preferred','old'),($2,$3,'candidate',null)", [first, second, site]);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${site}'`);
  await db.query("select gridpulse_prefer_strategy($1,$2,'new')", [site, second]);
  assert.equal((await db.query("select id from connection_scenarios where selection_status='preferred'")).rows[0].id, second);
  await assert.rejects(db.query("select gridpulse_prefer_strategy($1,$2,'bad')", [site, site]));
  assert.equal((await db.query("select id from connection_scenarios where selection_status='preferred'")).rows[0].id, second);
  const decision = { scenario_id: second, rationale: "reviewed", evidence_ids: [] };
  const call = actions => db.query("select gridpulse_record_strategy_decision($1,$2,$3,$4) as result", [site, decision, actions, { scenario_name: "test" }]);
  await assert.rejects(call([{ due_at: "invalid-date", title: "invalid" }]));
  assert.equal((await db.query("select count(*)::int as count from connection_decisions")).rows[0].count, 0);
  const results = await Promise.all([call([{ title: "one", due_at: "2026-10-12T00:00:00Z" }]), call([{ title: "two", due_at: "2026-10-13T00:00:00Z" }])]);
  assert.deepEqual(results.map(row => row.rows[0].result.version).sort(), [1, 2]);
  assert.equal((await db.query("select count(*)::int as count from assessment_activity")).rows[0].count, 2);
  const append = () => db.query("select gridpulse_append_flexibility($1,$2) as result", [site, { name: "test", version: 999, user_id: first }]);
  const appended = await Promise.all([append(), append()]);
  assert.deepEqual(appended.map(row => row.rows[0].result.version).sort(), [1, 2]);
  assert.equal((await db.query("select user_id from flexibility_profiles limit 1")).rows[0].user_id, site);
  const packageCall = () => db.query("select gridpulse_append_strategy_package($1,$2) as result", [site, { status: "draft", snapshot: {}, manifest: {}, input_manifest: {} }]);
  const packages = await Promise.all([packageCall(), packageCall()]);
  assert.deepEqual(packages.map(row => row.rows[0].result.version).sort(), [1,2]);
  await db.query("insert into interval_profiles values($1,$2)", [first, site]);
  const simulationCall = () => db.query("select gridpulse_append_strategy_simulation($1,$2) as result", [site, { profile_id: first, scenario_id: second, settings: {}, summary: {}, timeline: [], calculation_version: "fixture", classification: "fixture", input_manifest: {} }]);
  const simulations = await Promise.all([simulationCall(), simulationCall()]);
  assert.deepEqual(simulations.map(row => row.rows[0].result.version).sort(), [1,2]);
  await db.exec(`set request.jwt.claim.sub='${first}'`);
  await assert.rejects(call([]));
  console.log("Strategy transactions: rollback, preferred uniqueness, permission checks and version allocation passed.");
} finally { await db.close(); }
