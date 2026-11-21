import { neon } from "@neondatabase/serverless";
import targets from "../../deployment/neon-finder/targets.json" with { type: "json" };
import release from "../../deployment/neon-finder/release.json" with { type: "json" };

/** Server-only, read-only transport for the qualified environment projection. */
export type NeonFinderEnv = {
  PUBLIC_FINDER_PROVIDER?: string;
  NEON_FINDER_HOST?: string;
  FINDER_DATA_RELEASE?: string;
  NEON_DATABASE_URL?: string;
  PUBLIC_FINDER_ENVIRONMENT?: string;
  FINDER_DATA_SHA256?: string;
};

const qualified = (id: number, hash: number) =>
  `exists (select 1 from finder_public.active_snapshot a join finder_public.snapshots s on s.id=a.snapshot_id where a.snapshot_id=$${id} and s.manifest_sha256=$${hash})`;
type Operation = "viewport" | "tile" | "coverage" | "operators" | "study";
const QUERIES: Record<Operation, string> = {
  viewport: `select finder_public.viewport($1,$2,$3,$4,$5,$6,$7) as payload where ${qualified(8, 9)}`,
  tile: `select encode(finder_public.tile($1,$2,$3,$4,$5,$6),'hex') as payload where ${qualified(7, 8)}`,
  coverage: `select finder_public.coverage() as payload where ${qualified(1, 2)}`,
  operators: `select finder_public.operators() as payload where ${qualified(1, 2)}`,
  study: `select finder_public.study($1) as payload where ${qualified(2, 3)}`,
};

export function neonFinderConfigured(env: NeonFinderEnv): boolean {
  if (env.PUBLIC_FINDER_PROVIDER !== "neon") return false;
  try {
    const name = env.PUBLIC_FINDER_ENVIRONMENT ?? "staging";
    if (name !== "staging" && name !== "production") return false;
    const target = targets[name];
    const url = new URL(env.NEON_DATABASE_URL ?? "");
    return (
      url.protocol === "postgresql:" &&
      url.hostname === target.pooledHost &&
      env.NEON_FINDER_HOST === target.pooledHost &&
      env.FINDER_DATA_RELEASE === release.id &&
      (env.FINDER_DATA_SHA256 ?? (name === "staging" ? release.manifestSha256 : "")) ===
        release.manifestSha256 &&
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
  return env.PUBLIC_FINDER_PROVIDER === "neon"
    ? `neon:${env.PUBLIC_FINDER_ENVIRONMENT ?? "staging"}:${env.FINDER_DATA_RELEASE}:${env.FINDER_DATA_SHA256 ?? release.manifestSha256}`
    : "supabase";
}

export function finderReleaseMatches(url: URL, env: NeonFinderEnv): boolean {
  const token = url.searchParams.get("release");
  return (
    env.PUBLIC_FINDER_PROVIDER !== "neon" ||
    token === null ||
    token === `${env.FINDER_DATA_RELEASE}:${env.FINDER_DATA_SHA256 ?? release.manifestSha256}`
  );
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
  const rows = await sql.query(QUERIES[operation], [
    ...parameters,
    env.FINDER_DATA_RELEASE,
    env.FINDER_DATA_SHA256 ?? release.manifestSha256,
  ]);
  if (rows.length !== 1 || rows[0].payload == null)
    throw new Error("Qualified public projection is unavailable.");
  const payload: unknown = operation === "tile" ? `\\x${rows[0].payload}` : rows[0].payload;
  return Response.json(payload);
}
