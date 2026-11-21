import { readFile } from "node:fs/promises";
import { resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRestoreQuery } from "./neon-restore-query.mjs";
import { digest, verifyBatch } from "./neon-public-backup.mjs";
import { projectionId, expectedCounts } from "../deployment/neon-finder/export-query.mjs";
import targets from "../deployment/neon-finder/targets.json" with { type: "json" };

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

export function validateRestoreConnection(connection, environment) {
  const target = targets[environment];
  if (!target) throw new Error("Explicit registered restore environment required");
  const url = new URL(connection);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== target.directHost ||
    url.username !== "gridpulse_owner" ||
    url.pathname !== "/gridpulse" ||
    url.searchParams.get("sslmode") !== "require" ||
    !url.password
  )
    throw new Error("Restore requires the registered owner and direct connection");
}

export async function restoreBackup(
  directory,
  expectedManifestHash,
  connection,
  environment,
  progress = () => {},
) {
  const verified = await verifyBackup(directory, expectedManifestHash);
  validateRestoreConnection(connection, environment);
  // A fresh deadline belongs to each HTTP request, never the entire restore.
  const query = createRestoreQuery(connection);
  const existing = await query(
    "select id,activated_at,extras->>'restore_manifest_sha256' as restore_hash from finder_public.snapshots where id=$1",
    [projectionId],
  );
  if (
    existing.length &&
    (existing[0].activated_at || existing[0].restore_hash !== expectedManifestHash)
  )
    throw new Error("Restore target snapshot already exists; refusing to overwrite it");
  const s = verified.snapshot;
  if (!existing.length)
    await query(
      "insert into finder_public.snapshots(id,metadata,coverage,extras,expected_counts) values($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)",
      [
        s.id,
        JSON.stringify(s.metadata),
        JSON.stringify(s.coverage),
        JSON.stringify({ ...s.extras, restore_manifest_sha256: expectedManifestHash }),
        JSON.stringify(s.expected_counts),
      ],
    );
  let restored = 0;
  const completed = new Map(
    (
      await query("select batch_id,records from finder_public.batches where snapshot_id=$1", [
        projectionId,
      ])
    ).map((row) => [row.batch_id, Number(row.records)]),
  );
  for (const entry of verified.manifest.files) {
    if (completed.has(entry.file)) {
      if (completed.get(entry.file) !== entry.records)
        throw new Error("Recorded restore batch count differs");
      restored += entry.records;
      progress({ restored, batch: entry.file, expected: verified.records, resumed: true });
      continue;
    }
    const bytes = await readFile(join(directory, entry.file));
    verifyBatch(bytes, entry.sha256);
    await query("select finder_public.import_batch($1,$2,$3::jsonb)", [
      projectionId,
      entry.file,
      bytes.toString("utf8"),
    ]);
    restored += entry.records;
    progress({ restored, batch: entry.file, expected: verified.records });
  }
  await query("select finder_public.import_status($1,$2,$3)", [
    projectionId,
    verified.status.payload_text,
    verified.status.payload_sha256,
  ]);
  for (const zoom of [4, 5, 6, 7])
    await query("select finder_public.build_overview($1,$2)", [projectionId, zoom]);
  await query(
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
        : await restoreBackup(
            resolve(directory),
            hash,
            process.env.NEON_RESTORE_DATABASE_URL,
            process.env.NEON_RESTORE_ENVIRONMENT,
          );
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
