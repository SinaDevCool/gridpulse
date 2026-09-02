import type { PublicFinderEnv } from "./public-power-finder-api";

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
  if (env.PUBLIC_FINDER_RATE_LIMITER) {
    const limit = await env.PUBLIC_FINDER_RATE_LIMITER.limit({ key: `c1-study:${url.hostname}` });
    if (!limit.success) return response({ error: "Too many requests." }, 429);
  }
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
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
    const [c1Origin, c2Origin, c3Origin, c3BenchmarkOrigin] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c1_study`, options),
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c2_envelope`, options),
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c3_assessment`, c3Options),
      fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_c3_assessment`, benchmarkOptions),
    ]);
    if (!c1Origin.ok || !c2Origin.ok || !c3Origin.ok || !c3BenchmarkOrigin.ok) {
      return response({ error: "Study registry is unavailable." }, 502);
    }
    return response({
      ...(await c1Origin.json()),
      c2: await c2Origin.json(),
      c3: { ...(await c3Origin.json()), benchmark: await c3BenchmarkOrigin.json() },
    }, 200);
  } catch {
    return response({ error: "Study registry is unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
