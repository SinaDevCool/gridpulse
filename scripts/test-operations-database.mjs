import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// PostgreSQL semantics without a Docker dependency. Auth/storage are platform
// shims; staging still must verify actual Supabase JWT/RLS and concurrent workers.
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
    grant usage on schema auth to authenticated,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,name text,bucket_id text);
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    create table public.pilot_datasets(id uuid,evidence_class text,is_synthetic boolean);
  `);
  for (const file of [
    "20260724050000_analytics_job_foundation.sql",
    "20260809710000_durable_jobs_and_evidence_origin.sql",
    "20260926150000_power_operations_foundation.sql",
    "20260926160000_power_battery_operations.sql",
    "20260926170000_operations_connectors_workloads.sql",
    "20261006180000_operations_envelope_assurance.sql",
    "20261010120000_operations_ingestion_integrity.sql",
    "20261010130000_operations_worker_integrity.sql",
    "20261010140000_operations_review_integrity.sql",
    "20261010150000_operations_job_idempotency.sql",
  ])
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"),
    );
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const facility = "33333333-3333-4333-8333-333333333333";
  const source = "44444444-4444-4444-8444-444444444444";
  const batch = "55555555-5555-4555-8555-555555555555";
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query("insert into operations_facilities(id,owner_id,name) values($1,$2,'Test')", [
    facility,
    owner,
  ]);
  await db.query(
    "insert into operations_sources(id,owner_id,facility_id,source_type,display_name,connector_version,expected_interval_seconds) values($1,$2,$3,'facility_meter','Meter','v1',900)",
    [source, owner, facility],
  );
  await db.query(
    "insert into operations_connector_credentials(source_id,token_hash,metric_allowlist,expires_at) values($1,$2,array['facility_grid_import_mw'],now()+interval '1 day')",
    [source, "a".repeat(64)],
  );
  await db.exec("set request.jwt.claim.role='service_role'");
  const event = new Date(Date.now() - 60_000).toISOString();
  const row = {
    metric_key: "facility_grid_import_mw",
    asset_id: "facility",
    event_at: event,
    interval_seconds: 900,
    value: 80,
    unit: "MW",
    source_record_id: "one",
  };
  const ingest = (rows, token = "a".repeat(64), facilityId = facility) =>
    db.query("select operations_ingest_connector_batch($1,$2,$3,$4::jsonb,$5,'v1') result", [
      facilityId,
      source,
      batch,
      JSON.stringify(rows),
      token,
    ]);
  assert.equal((await ingest([row])).rows[0].result.inserted, 1);
  assert.equal((await ingest([row])).rows[0].result.duplicates, 1);
  await assert.rejects(ingest([row], "b".repeat(64)), /credential/);
  await assert.rejects(ingest([row], "a".repeat(64), other), /scope/);
  await assert.rejects(ingest([{ ...row, value: 81 }]), /Conflicting/);
  await assert.rejects(
    ingest([
      {
        ...row,
        source_record_id: "future",
        event_at: new Date(Date.now() + 600_000).toISOString(),
      },
    ]),
    /timestamp/,
  );
  await ingest([
    { ...row, source_record_id: "old", event_at: new Date(Date.now() - 3_600_000).toISOString() },
  ]);
  const watermark = (await db.query("select latest_event_at from operations_source_watermarks"))
    .rows[0];
  assert.equal(new Date(watermark.latest_event_at).toISOString(), event);
  assert.equal(
    (await db.query("select count(*)::int total from operations_measurements")).rows[0].total,
    2,
  );
  // One invalid record rolls back an entire batch, including its valid peer.
  await assert.rejects(
    ingest([
      { ...row, source_record_id: "new" },
      { ...row, source_record_id: "bad", unit: "kW" },
    ]),
    /Invalid/,
  );
  assert.equal(
    (await db.query("select count(*)::int total from operations_measurements")).rows[0].total,
    2,
  );
  await db.exec(
    `set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='${other}'; set role authenticated;`,
  );
  assert.equal((await db.query("select * from operations_measurements")).rows.length, 0);
  await assert.rejects(
    db.query("select operations_ingest_measurement_batch($1,$2,$3,$4::jsonb)", [
      facility,
      source,
      batch,
      JSON.stringify([row]),
    ]),
    /scope/,
  );
  await db.exec("reset role; set request.jwt.claim.role='service_role';");
  await db.query("insert into analytics_jobs(owner_id,job_type) values($1,'reference_topology')", [
    owner,
  ]);
  const job = (await db.query("select * from claim_analytics_job('worker-a',120)")).rows[0];
  assert.equal(job.attempt_count, 1);
  assert.equal(
    (await db.query("select * from claim_analytics_job('worker-b',120)")).rows.length,
    0,
  );
  await db.query("select * from cancel_analytics_job($1,$2)", [job.id, owner]);
  assert.equal(
    (
      await db.query("select * from update_leased_analytics_job($1,'worker-a',1,$2::jsonb)", [
        job.id,
        JSON.stringify({ status: "succeeded", completed_at: new Date().toISOString() }),
      ])
    ).rows.length,
    0,
  );
  await db.exec(`set request.jwt.claim.sub='${owner}'`);
  const recommendation = (
    await db.query(
      `insert into operations_recommendations(facility_id,owner_id,generated_at,expires_at,required_reduction_mw,expected_import_mw,feasible,input_fingerprint,calculation_version)
    values($1,$2,now(),now()+interval '1 hour',2,98,true,$3,'test') returning id`,
      [facility, owner, "c".repeat(64)],
    )
  ).rows[0].id;
  await db.exec("set role authenticated");
  const review = (
    await db.query(
      "insert into operations_dispatch_approvals(recommendation_id,facility_id,decision) values($1,$2,'approved') returning id,recommendation_input_fingerprint",
      [recommendation, facility],
    )
  ).rows[0];
  assert.equal(review.recommendation_input_fingerprint, "c".repeat(64));
  await assert.rejects(
    db.query("update operations_dispatch_approvals set decision='rejected' where id=$1", [
      review.id,
    ]),
    /permission/,
  );
  await db.query(
    "insert into operations_dispatch_approvals(recommendation_id,facility_id,decision) values($1,$2,'revoked')",
    [recommendation, facility],
  );
  await db.exec("reset role");
  await assert.rejects(
    db.query("update operations_recommendations set expected_import_mw=90 where id=$1", [
      recommendation,
    ]),
    /new recommendation/,
  );
  const payload = {
    id: "66666666-6666-4666-8666-666666666666",
    owner_id: owner,
    job_type: "reference_topology",
    input_payload: {},
    input_fingerprint: "d".repeat(64),
  };
  const first = (
    await db.query("select * from create_analytics_job_once($1::jsonb)", [JSON.stringify(payload)])
  ).rows[0];
  const duplicate = (
    await db.query("select * from create_analytics_job_once($1::jsonb)", [
      JSON.stringify({ ...payload, id: "77777777-7777-4777-8777-777777777777" }),
    ])
  ).rows[0];
  assert.equal(first.id, duplicate.id);
  console.log(
    "Operations PostgreSQL migrations, scoped ingestion, deduplication, rollback, RLS and cancellation checks passed.",
  );
} finally {
  await db.close();
}
