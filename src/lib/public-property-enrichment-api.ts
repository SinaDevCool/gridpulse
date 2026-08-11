import type { PublicFinderEnv } from "./public-power-finder-api";

const PATH = "/api/properties/enrich";
const SOURCES = new Set([
  "bkg_admin",
  "osm_context",
  "bfn_protected",
  "mastr",
  "bkg_heavy_rain",
  "power_finder",
]);

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function envValue(env: PublicFinderEnv, key: "url" | "key") {
  return key === "url"
    ? env.SUPABASE_URL || env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
    : env.SUPABASE_PUBLISHABLE_KEY ||
        env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

export function parseEnrichmentRequest(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Request body is required.");
  const body = value as { properties?: unknown[]; sources?: unknown[] };
  if (!Array.isArray(body.properties) || body.properties.length < 1 || body.properties.length > 100)
    throw new Error("Provide 1–100 properties.");
  const properties = body.properties.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Every property must be an object.");
    const item = raw as Record<string, unknown>;
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    if (
      typeof item.propertyId !== "string" ||
      item.propertyId.length > 100 ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 47.2 ||
      latitude > 55.2 ||
      longitude < 5.8 ||
      longitude > 15.1
    )
      throw new Error("Each property requires an ID and valid German coordinates.");
    const boundary = item.boundary == null ? null : item.boundary;
    const encodedBoundary = JSON.stringify(boundary);
    if (encodedBoundary.length > 200_000) throw new Error("A property boundary is too complex.");
    return { property_id: item.propertyId, latitude, longitude, boundary };
  });
  const sources = (Array.isArray(body.sources) ? body.sources : [...SOURCES]).map(String);
  if (!sources.length || sources.some((source) => !SOURCES.has(source)))
    throw new Error("An unsupported enrichment source was requested.");
  return { properties, sources: Array.from(new Set(sources)) };
}

export async function handlePublicPropertyEnrichment(request: Request, env: PublicFinderEnv) {
  const url = new URL(request.url);
  if (url.pathname !== PATH) return null;
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405, { allow: "POST" });
  let input: ReturnType<typeof parseEnrichmentRequest>;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 1_000_000)
      throw new Error("Request exceeds the 1 MB limit.");
    input = parseEnrichmentRequest(await request.json());
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request." }, 400);
  }
  if (env.PUBLIC_FINDER_RATE_LIMITER) {
    const result = await env.PUBLIC_FINDER_RATE_LIMITER.limit({
      key: `property-enrichment:${url.hostname}`,
    });
    if (!result.success)
      return json({ error: "Too many enrichment requests." }, 429, { "retry-after": "60" });
  }
  const supabaseUrl = envValue(env, "url");
  const key = envValue(env, "key");
  if (!supabaseUrl || !key)
    return json({ error: "Enrichment data is temporarily unavailable." }, 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/property_enrichment_batch`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: key.startsWith("eyJ") ? `Bearer ${key}` : "",
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_properties: input.properties, p_sources: input.sources }),
      signal: controller.signal,
    });
    if (!response.ok)
      return json({ error: "The accepted enrichment release is unavailable." }, 502);
    const body = await response.text();
    if (body.length > 6_000_000)
      return json({ error: "Enrichment response exceeded the safe limit." }, 502);
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Property enrichment is temporarily unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
