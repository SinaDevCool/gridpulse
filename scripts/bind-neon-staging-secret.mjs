import { spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { staging } from "./check-staging-candidate.mjs";

export function validateReaderUri(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Missing staging reader credential");
  }
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== staging.neonHost ||
    url.username !== "gridpulse_finder_reader" ||
    url.pathname !== "/gridpulse" ||
    !url.password ||
    url.searchParams.get("sslmode") !== "require"
  ) {
    throw new Error("Credential must be the dedicated staging read-only role");
  }
}

export async function qualifyReader(value) {
  validateReaderUri(value);
  const sql = neon(value, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
  const rows = await sql.query(
    "select snapshot_id from finder_public.active_snapshot where snapshot_id=$1",
    [staging.dataRelease],
  );
  if (rows.length !== 1) throw new Error("Qualified staging snapshot is not active");
  const [role] = await sql.query(
    "select rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,pg_has_role(current_user,'neon_superuser','MEMBER') as admin_member,has_table_privilege(current_user,'finder_public.features','INSERT') as writable from pg_roles where rolname=current_user",
  );
  if (!role || Object.values(role).some(Boolean))
    throw new Error("Staging role has excess privileges");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const credential = process.env.NEON_DATABASE_URL;
    await qualifyReader(credential);
    const { NEON_DATABASE_URL: omitted, ...childEnv } = process.env;
    void omitted;
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "secret",
        "put",
        "NEON_DATABASE_URL",
        "--config",
        "dist/server/wrangler.json",
      ],
      {
        env: childEnv,
        input: credential + "\n",
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (result.status !== 0) throw new Error("Staging secret binding failed");
    console.log("Qualified read-only credential bound to staging Worker.");
  } catch {
    console.error("Staging credential qualification or binding failed.");
    process.exitCode = 1;
  }
}
