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
const SOURCE_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;

type SourceStatus = "succeeded" | "unavailable" | "timed_out" | "not_covered" | "failed";

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

function normalizeStatus(value: unknown): SourceStatus {
  if (value === "complete" || value === "succeeded") return "succeeded";
  if (value === "not_covered") return "not_covered";
  if (value === "unavailable") return "unavailable";
  if (value === "timed_out") return "timed_out";
  if (value === "failed") return "failed";
  return "failed";
}

async function enrichSource(
  supabaseUrl: string,
  key: string,
  properties: ReturnType<typeof parseEnrichmentRequest>["properties"],
  source: string,
): Promise<{ source: string; status: SourceStatus; body: Record<string, unknown> | null }> {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/property_enrichment_batch`, {
        method: "POST",
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_properties: properties, p_sources: [source] }),
        signal: controller.signal,
      });
      lastStatus = response.status;
      if (!response.ok) {
        if (attempt < MAX_ATTEMPTS && (response.status === 429 || response.status >= 500)) continue;
        return {
          source,
          status: response.status === 404 ? "unavailable" : "failed",
          body: null,
        };
      }
      const text = await response.text();
      if (text.length > 2_000_000) return { source, status: "failed" as const, body: null };
      const body = JSON.parse(text) as Record<string, unknown>;
      if (!Array.isArray(body.findings) || typeof body.sourceStatus !== "object")
        return { source, status: "failed" as const, body: null };
      const sourceStatus = body.sourceStatus as Record<string, unknown>;
      return { source, status: normalizeStatus(sourceStatus[source]), body };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      if (attempt < MAX_ATTEMPTS) continue;
      return { source, status: timedOut ? "timed_out" : "failed", body: null };
    } finally {
      clearTimeout(timeout);
    }
  }
  return { source, status: lastStatus === 404 ? "unavailable" : "failed", body: null };
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
  const results = await Promise.all(
    input.sources.map((source) => enrichSource(supabaseUrl, key, input.properties, source)),
  );
  const findings = results.flatMap((result) =>
    result.body && Array.isArray(result.body.findings) ? result.body.findings : [],
  );
  const sourceStatus = Object.fromEntries(results.map((result) => [result.source, result.status]));
  const sourceResults = results.flatMap((result) => {
    if (result.body && Array.isArray(result.body.sourceResults)) {
      return result.body.sourceResults.map((item) => {
        const sourceResult = item as Record<string, unknown>;
        return {
          ...sourceResult,
          status: normalizeStatus(sourceResult.status ?? result.status),
        };
      });
    }
    return input.properties.map((property) => ({
      propertyId: property.property_id,
      source: result.source,
      status: result.status,
      findingCount: 0,
      releaseId: null,
      checkedAt: new Date().toISOString(),
      limitation:
        result.status === "timed_out"
          ? "The source timed out after a safe retry."
          : "The source could not be checked; retry this source.",
    }));
  });
  const fingerprints = results
    .map((result) => result.body?.releaseFingerprint)
    .filter((value): value is string => typeof value === "string");
  return json(
    {
      releaseFingerprint: fingerprints.join(":") || "no-source-release",
      findings,
      sourceStatus,
      sourceResults,
    },
    200,
    { "cache-control": "no-store" },
  );
}
