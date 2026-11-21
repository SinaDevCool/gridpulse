import { neon } from "@neondatabase/serverless";
import targets from "../deployment/neon-finder/targets.json" with { type: "json" };
import release from "../deployment/neon-finder/release.json" with { type: "json" };

export function validateReaderUri(value, environment = "staging") {
  const target = targets[environment];
  if (!target) throw Error("Registered Finder environment required");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Error("Missing Finder reader credential");
  }
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== target.pooledHost ||
    url.username !== "gridpulse_finder_reader" ||
    url.pathname !== "/gridpulse" ||
    !url.password ||
    url.searchParams.get("sslmode") !== "require"
  )
    throw Error("Credential must be the dedicated environment read-only role");
}

export async function qualifyReader(value, environment = "staging") {
  validateReaderUri(value, environment);
  const query = (text, parameters = []) =>
    neon(value, { fetchOptions: { signal: AbortSignal.timeout(15000) } }).query(text, parameters);
  const rows = await query(
    "select a.snapshot_id from finder_public.active_snapshot a join finder_public.snapshots s on s.id=a.snapshot_id where a.snapshot_id=$1 and s.manifest_sha256=$2",
    [release.id, release.manifestSha256],
  );
  if (rows.length !== 1) throw Error("Qualified Finder snapshot is not active");
  const [role] = await query(
    "select rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,pg_has_role(current_user,'neon_superuser','MEMBER') as admin_member,has_table_privilege(current_user,'finder_public.features','INSERT') as writable,has_function_privilege(current_user,'finder_public.activate(text,text)','EXECUTE') as can_activate from pg_roles where rolname=current_user",
  );
  if (!role || Object.values(role).some(Boolean))
    throw Error("Finder reader has excess privileges");
  const [size] = await query("select pg_database_size(current_database()) as database_bytes");
  const databaseBytes = Number(size?.database_bytes);
  if (
    !Number.isSafeInteger(databaseBytes) ||
    databaseBytes <= 0 ||
    databaseBytes > release.maxDatabaseBytes
  )
    throw Error("Finder database exceeds the admitted free-tier safety budget");
  return {
    environment,
    snapshot: release.id,
    manifestSha256: release.manifestSha256,
    databaseBytes,
  };
}
