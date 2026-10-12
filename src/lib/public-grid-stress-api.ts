import type { PublicFinderEnv } from "./public-power-finder-api";

const PATH = "/api/forecasts/grid-stress/current";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=300", "x-content-type-options": "nosniff" } });
}

export async function handlePublicGridStressRequest(request: Request, env: PublicFinderEnv) {
  const url = new URL(request.url);
  if (url.pathname !== PATH) return null;
  if (request.method !== "GET") return response({ error: "Method not allowed." }, 405);
  const region = (url.searchParams.get("region") ?? "DE").toUpperCase();
  if (!/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(region)) return response({ error: "Invalid region." }, 400);
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !key) return response(unavailable(region, "Forecast store is not configured."));
  try {
    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/grid_stress_public_current`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ p_region_code: region }), signal: AbortSignal.timeout(8000) });
    if (!result.ok) return response(unavailable(region, "No verified forecast is currently available."));
    const rows = await result.json() as Array<{ payload?: unknown }>;
    return response(rows[0]?.payload ?? unavailable(region, "No accepted real-data model prediction has been published yet."));
  } catch {
    return response(unavailable(region, "The forecast service is temporarily unavailable."));
  }
}

function unavailable(regionCode: string, message: string) {
  return { schemaVersion: "gridpulse-grid-stress-public-v1", status: "unavailable", regionCode, confidence: "unavailable", drivers: [], caveats: [], sourceFreshness: {}, decisionBoundary: "Regional public-data forecast; not available connection capacity or an operator offer.", message };
}
