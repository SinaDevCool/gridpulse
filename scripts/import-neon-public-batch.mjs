import { neon } from "@neondatabase/serverless";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { digest, verifyBatch } from "./neon-public-backup.mjs";
import { projectionId } from "../deployment/neon-finder/export-query.mjs";

try {
  const file = resolve(process.argv[2]);
  if (
    !file.includes(`${projectionId}`) ||
    !/^[0-9]+-(nodes|lines|sites|assets)\.json$/.test(basename(file))
  )
    throw new Error("Unexpected batch path");
  const config = JSON.parse(await readFile(".codex-tmp/neon-staging-owner.local", "utf8"));
  const url = new URL(config.connection);
  if (
    ![
      "ep-patient-breeze-bhm3qx7z.c-10.eu-central-1.aws.neon.tech",
      "ep-patient-breeze-bhm3qx7z-pooler.c-10.eu-central-1.aws.neon.tech",
    ].includes(url.hostname) ||
    url.username !== "gridpulse_owner" ||
    url.pathname !== "/gridpulse"
  )
    throw new Error("Unexpected staging database");
  const bytes = await readFile(file);
  const rows = verifyBatch(bytes, digest(bytes));
  if (rows.length > 5000 || bytes.length > 32000000) throw new Error("Oversized batch");
  const sql = neon(config.connection, { fetchOptions: { signal: AbortSignal.timeout(60000) } });
  const result = await sql.query("select finder_public.import_batch($1,$2,$3::jsonb) as imported", [
    projectionId,
    basename(file),
    bytes.toString("utf8"),
  ]);
  const info = {
    file: basename(file),
    sha256: digest(bytes),
    bytes: bytes.length,
    records: rows.length,
    first: rows[0]?.cursor,
    last: rows.at(-1)?.cursor,
    imported: result[0].imported,
  };
  const checksumFile = `${file}.sha256.json`;
  try {
    await writeFile(checksumFile, JSON.stringify(info, null, 2), { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const old = JSON.parse(await readFile(checksumFile, "utf8"));
    if (old.sha256 !== info.sha256) throw new Error("Existing backup checksum changed");
  }
  console.log(JSON.stringify(info));
} catch (e) {
  console.error(String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted database URL]"));
  process.exitCode = 1;
}
