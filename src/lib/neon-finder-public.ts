import { neon } from "@neondatabase/serverless";

/** Server-only, read-only transport for the qualified staging projection. */
export type NeonFinderEnv = {
  PUBLIC_FINDER_PROVIDER?: string;
  NEON_FINDER_HOST?: string;
  FINDER_DATA_RELEASE?: string;
  NEON_DATABASE_URL?: string;
};

const HOST = "ep-patient-breeze-bhm3qx7z-pooler.c-10.eu-central-1.aws.neon.tech";
const RELEASE = "finder-public-20261121-v1";
type Operation = "viewport" | "tile" | "coverage" | "operators" | "study";
const QUERIES: Record<Operation, string> = {
  viewport:
    "select finder_public.viewport($1,$2,$3,$4,$5,$6,$7) as payload where exists (select 1 from finder_public.active_snapshot where snapshot_id=$8)",
  tile: "select encode(finder_public.tile($1,$2,$3,$4,$5,$6),'hex') as payload where exists (select 1 from finder_public.active_snapshot where snapshot_id=$7)",
  coverage:
    "select finder_public.coverage() as payload where exists (select 1 from finder_public.active_snapshot where snapshot_id=$1)",
  operators:
    "select finder_public.operators() as payload where exists (select 1 from finder_public.active_snapshot where snapshot_id=$1)",
  study:
    "select finder_public.study($1) as payload where exists (select 1 from finder_public.active_snapshot where snapshot_id=$2)",
};

export function neonFinderConfigured(env: NeonFinderEnv): boolean {
  if (env.PUBLIC_FINDER_PROVIDER !== "neon") return false;
  try {
    const url = new URL(env.NEON_DATABASE_URL ?? "");
    return (
      url.protocol === "postgresql:" &&
      url.hostname === HOST &&
      env.NEON_FINDER_HOST === HOST &&
      env.FINDER_DATA_RELEASE === RELEASE &&
      url.username === "gridpulse_finder_reader" &&
      url.pathname === "/gridpulse" &&
      !!url.password &&
      url.searchParams.get("sslmode") === "require"
    );
  } catch {
    return false;
  }
}

export function finderProviderAllowed(env: NeonFinderEnv): boolean {
  return (
    !env.PUBLIC_FINDER_PROVIDER ||
    env.PUBLIC_FINDER_PROVIDER === "supabase" ||
    neonFinderConfigured(env)
  );
}

export function finderCachePartition(env: NeonFinderEnv): string {
  return env.PUBLIC_FINDER_PROVIDER === "neon" ? `neon:${env.FINDER_DATA_RELEASE}` : "supabase";
}

export async function neonPublicRpc(
  env: NeonFinderEnv,
  operation: Operation,
  parameters: unknown[] = [],
): Promise<Response> {
  if (!neonFinderConfigured(env)) throw new Error("Public projection is unavailable.");
  const sql = neon(env.NEON_DATABASE_URL!, {
    fetchOptions: { signal: AbortSignal.timeout(8000) },
  });
  const rows = await sql.query(QUERIES[operation], [...parameters, env.FINDER_DATA_RELEASE]);
  if (rows.length !== 1 || rows[0].payload == null)
    throw new Error("Qualified public projection is unavailable.");
  const payload: unknown = operation === "tile" ? `\\x${rows[0].payload}` : rows[0].payload;
  return Response.json(payload);
}
