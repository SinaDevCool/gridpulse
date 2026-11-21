import { finderRequestAllowed } from "./finder-request-limit";
import type { PublicFinderEnv } from "./public-power-finder-api";
import { finderProviderAllowed, neonPublicRpc } from "./neon-finder-public";

const PATH = "/api/power-finder/study";

function response(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function handlePublicC1StudyRequest(request: Request, env: PublicFinderEnv) {
  const url = new URL(request.url);
  if (url.pathname !== PATH) return null;
  if (request.method !== "GET") return response({ error: "Method not allowed." }, 405);
  const nodeId = url.searchParams.get("node")?.trim() || null;
  if (nodeId && (!/^[A-Za-z0-9:._-]+$/.test(nodeId) || nodeId.length > 200)) {
    return response({ error: "Invalid node identifier." }, 400);
  }
  if (!(await finderRequestAllowed(request, env, "c1-study")))
    return response({ error: "Too many requests." }, 429);
  if (!finderProviderAllowed(env))
    return response({ error: "Study registry is unavailable." }, 503);
  if (env.PUBLIC_FINDER_PROVIDER === "neon") {
    try {
      const result = await neonPublicRpc(env, "study", [nodeId]);
      return response(await result.json(), 200);
    } catch {
      return response({ error: "Study registry is unavailable." }, 502);
    }
  }
  const supabaseUrl =
    env.SUPABASE_URL || env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !key) return response({ error: "Study registry is unavailable." }, 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
    if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
    const options = {
      method: "POST",
      headers,
      body: JSON.stringify({ node_record_id: nodeId }),
      signal: controller.signal,
    };
    const c3Options = { ...options, body: JSON.stringify({ p_node_record_id: nodeId }) };
    const benchmarkOptions = { ...options, body: JSON.stringify({ p_node_record_id: null }) };
    const [c1Origin, c2Origin, c3Origin, c3BenchmarkOrigin] = await Promise.allSettled([
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c1_study`, options),
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c2_envelope`, options),
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c3_assessment`, c3Options),
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c3_assessment`, benchmarkOptions),
    ]);
    const unavailable = { available: false, reason: "Optional study evidence is unavailable." };
    const read = async (result: PromiseSettledResult<Response>, fallback: unknown) => {
      if (result.status !== "fulfilled" || !result.value.ok) return fallback;
      try {
        return await result.value.json();
      } catch {
        return fallback;
      }
    };
    const c1 = await read(c1Origin, null);
    if (!c1) return response({ error: "Study registry is unavailable." }, 502);
    return response(
      {
        ...c1,
        c2: await read(c2Origin, {
          node_envelope: unavailable,
          benchmark_ensemble: unavailable,
          evidence_boundary: "Hourly evidence unavailable.",
        }),
        c3: {
          ...(await read(c3Origin, unavailable)),
          benchmark: await read(c3BenchmarkOrigin, unavailable),
        },
      },
      200,
    );
  } catch {
    return response({ error: "Study registry is unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
