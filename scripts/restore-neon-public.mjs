import { readFile } from "node:fs/promises";
import { resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { digest, verifyBatch } from "./neon-public-backup.mjs";
import { projectionId, expectedCounts } from "../deployment/neon-finder/export-query.mjs";

/** Verifies every file before returning anything a restore may write. */
export async function verifyBackup(directory, expectedManifestHash) {
  const manifestBytes = await readFile(join(directory, "manifest.json"));
  if (digest(manifestBytes) !== expectedManifestHash) throw new Error("Manifest checksum mismatch");
  const manifest = JSON.parse(manifestBytes);
  if (manifest.snapshot !== projectionId || !Array.isArray(manifest.files))
    throw new Error("Invalid manifest");
  const names = new Set();
  const counts = {};
  let records = 0;
  for (const entry of manifest.files) {
    if (
      entry.file !== basename(entry.file) ||
      !/^\d{6}-(nodes|lines|sites|assets)\.json$/.test(entry.file) ||
      names.has(entry.file)
    )
      throw new Error("Invalid or duplicate backup path");
    names.add(entry.file);
    const bytes = await readFile(join(directory, entry.file));
    if (bytes.length !== entry.bytes) throw new Error("Backup size mismatch");
    const rows = verifyBatch(bytes, entry.sha256);
    if (rows.length !== entry.records) throw new Error("Backup count mismatch");
    for (const row of rows) counts[row.kind] = (counts[row.kind] ?? 0) + 1;
    records += rows.length;
  }
  for (const [kind, expected] of Object.entries(expectedCounts))
    if (counts[kind] !== expected) throw new Error("Backup admission counts differ");
  if (Object.keys(counts).length !== Object.keys(expectedCounts).length)
    throw new Error("Unexpected feature kind");
  const snapshotBytes = await readFile(join(directory, "snapshot.json"));
  if (digest(snapshotBytes) !== manifest.snapshot_sha256)
    throw new Error("Snapshot metadata checksum mismatch");
  const snapshot = JSON.parse(snapshotBytes);
  const statusBytes = await readFile(join(directory, "status.json"));
  if (digest(statusBytes) !== manifest.status_sha256)
    throw new Error("Status supplement checksum mismatch");
  const status = JSON.parse(statusBytes);
  const sourceAfter = await readFile(join(directory, "source-after.json"));
  if (digest(sourceAfter) !== manifest.source_after_sha256)
    throw new Error("Source postflight checksum mismatch");
  if (digest(Buffer.from(status.payload_text)) !== status.payload_sha256)
    throw new Error("Source status payload checksum mismatch");
  if (
    snapshot.id !== projectionId ||
    JSON.stringify(snapshot.expected_counts) !== JSON.stringify(expectedCounts)
  )
    throw new Error("Snapshot admission metadata differs");
  return { manifest, snapshot, status, records, counts };
}

export async function restoreBackup(directory, expectedManifestHash, connection) {
  const verified = await verifyBackup(directory, expectedManifestHash);
  const url = new URL(connection);
  if (
    url.hostname !== "ep-patient-breeze-bhm3qx7z.c-10.eu-central-1.aws.neon.tech" ||
    url.username !== "gridpulse_owner" ||
    url.pathname !== "/gridpulse"
  )
    throw new Error("Restore requires the dedicated staging owner and direct connection");
  const sql = neon(connection, { fetchOptions: { signal: AbortSignal.timeout(60000) } });
  const existing = await sql.query("select id from finder_public.snapshots where id=$1", [
    projectionId,
  ]);
  if (existing.length)
    throw new Error("Restore target snapshot already exists; refusing to overwrite it");
  const s = verified.snapshot;
  await sql.query(
    "insert into finder_public.snapshots(id,metadata,coverage,extras,expected_counts) values($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)",
    [
      s.id,
      JSON.stringify(s.metadata),
      JSON.stringify(s.coverage),
      JSON.stringify(s.extras),
      JSON.stringify(s.expected_counts),
    ],
  );
  for (const entry of verified.manifest.files) {
    const bytes = await readFile(join(directory, entry.file));
    verifyBatch(bytes, entry.sha256);
    await sql.query("select finder_public.import_batch($1,$2,$3::jsonb)", [
      projectionId,
      entry.file,
      bytes.toString("utf8"),
    ]);
  }
  await sql.query("select finder_public.import_status($1,$2,$3)", [
    projectionId,
    verified.status.payload_text,
    verified.status.payload_sha256,
  ]);
  for (const zoom of [4, 5, 6, 7])
    await sql.query("select finder_public.build_overview($1,$2)", [projectionId, zoom]);
  await sql.query(
    "analyze finder_public.features, finder_public.operational_status, finder_public.registry_overview, finder_public.snapshots, finder_public.active_snapshot",
  );
  // Activation remains an explicit qualification step; this loader never switches traffic.
  return { records: verified.records, snapshot: projectionId, active: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, directory, hash] = process.argv.slice(2);
    if (!["verify", "restore"].includes(action) || !directory || !/^[0-9a-f]{64}$/.test(hash ?? ""))
      throw new Error("Use verify|restore <backup-directory> <manifest-sha256>");
    const result =
      action === "verify"
        ? await verifyBackup(resolve(directory), hash)
        : await restoreBackup(resolve(directory), hash, process.env.NEON_RESTORE_DATABASE_URL);
    console.log(
      JSON.stringify({
        verified: true,
        records: result.records,
        counts: result.counts,
        active: false,
      }),
    );
  } catch {
    console.error("Backup verification or restore failed; no traffic was activated.");
    process.exitCode = 1;
  }
}
