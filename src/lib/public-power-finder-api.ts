import { scopeFallback } from "../features/power-finder/fallback-scope";
import type { PowerFinderCollection } from "@/features/power-finder/fixture-data";
import { publicFinderCoverage } from "./public-finder-coverage";
import { finderRequestAllowed } from "./finder-request-limit";
import {
  finderCachePartition,
  finderProviderAllowed,
  neonFinderConfigured,
  neonPublicRpc,
  type NeonFinderEnv,
} from "./neon-finder-public";

const PUBLIC_VIEWPORT_PATH = "/api/power-finder/viewport";
const ACCEPTED_STATIC_FALLBACK_PATH = "/power-finder/brandenburg-osm.json";
const PUBLIC_TILE_PATTERN = /^\/api\/power-finder\/tile\/(\d+)\/(\d+)\/(\d+)$/;
const CACHE_SECONDS = 300;
const TILE_CACHE_RELEASE = "finder-evidence-v3";
const TILE_EDGE_CACHE_SECONDS = 300;

export type PublicFinderEnv = NeonFinderEnv & {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  PUBLIC_FINDER_RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
};

type ExecutionContextLike = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

type ViewportParameters = {
  west: number;
  south: number;
  east: number;
  north: number;
  includeGeneration: boolean;
  includeStorage: boolean;
};

function finiteParameter(url: URL, name: string) {
  const raw = url.searchParams.get(name);
  const value = raw === null ? Number.NaN : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}

function booleanParameter(url: URL, name: string, fallback: boolean) {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new Error(`${name} must be true or false.`);
}

export function parsePublicViewportRequest(url: URL): ViewportParameters {
  const parameters = {
    west: finiteParameter(url, "west"),
    south: finiteParameter(url, "south"),
    east: finiteParameter(url, "east"),
    north: finiteParameter(url, "north"),
    includeGeneration: booleanParameter(url, "generation", true),
    includeStorage: booleanParameter(url, "storage", true),
  };
  if (
    parameters.west >= parameters.east ||
    parameters.south >= parameters.north ||
    parameters.west < 5.8 ||
    parameters.east > 15.1 ||
    parameters.south < 47.2 ||
    parameters.north > 55.2 ||
    (parameters.east - parameters.west) * (parameters.north - parameters.south) > 6
  ) {
    throw new Error("The viewport is outside Germany or exceeds the safe query area.");
  }
  return parameters;
}

function normalizedCacheUrl(requestUrl: URL, parameters: ViewportParameters) {
  const cacheUrl = new URL(PUBLIC_VIEWPORT_PATH, requestUrl.origin);
  const values = {
    west: parameters.west,
    south: parameters.south,
    east: parameters.east,
    north: parameters.north,
  };
  for (const [name, value] of Object.entries(values)) {
    cacheUrl.searchParams.set(name, String(value));
  }
  cacheUrl.searchParams.set("generation", String(parameters.includeGeneration));
  cacheUrl.searchParams.set("storage", String(parameters.includeStorage));
  cacheUrl.searchParams.set("ranking", String(requestUrl.searchParams.get("ranking") === "true"));
  return cacheUrl;
}

function jsonResponse(body: unknown, status: number, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

async function acceptedStaticFallback(
  requestUrl: URL,
  env: PublicFinderEnv,
  parameters: ViewportParameters,
) {
  try {
    const fallbackRequest = new Request(new URL(ACCEPTED_STATIC_FALLBACK_PATH, requestUrl.origin));
    const response = env.ASSETS
      ? await env.ASSETS.fetch(fallbackRequest)
      : await fetch(fallbackRequest);
    if (!response.ok) return null;
    const raw = (await response.json()) as PowerFinderCollection;
    if (raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) return null;
    const payload = scopeFallback(raw, parameters);
    if (!payload.features.length) return null;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) return null;
    const availableKinds = [
      ...new Set(payload.features.map((feature) => feature.properties?.kind).filter(Boolean)),
    ];
    return jsonResponse(
      {
        ...payload,
        metadata: {
          ...payload.metadata,
          record_count: payload.features.length,
          available_kinds: availableKinds,
          coverage_status: "accepted_static_fallback",
          fallback_reason: "live_public_origin_unavailable",
        },
      },
      200,
      {
        "cache-control": "public, max-age=60, s-maxage=300, stale-if-error=3600",
        "x-gridpulse-data-mode": "accepted-static-fallback",
      },
    );
  } catch {
    return null;
  }
}

function environmentValue(env: PublicFinderEnv, name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  if (name === "SUPABASE_URL") {
    return env.SUPABASE_URL || env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  }
  if (name === "SUPABASE_PUBLISHABLE_KEY") {
    return (
      env.SUPABASE_PUBLISHABLE_KEY ||
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    );
  }
}

export async function handlePublicPowerFinderRequest(
  request: Request,
  env: PublicFinderEnv,
  context: ExecutionContextLike = {},
) {
  const url = new URL(request.url);
  if (url.pathname !== PUBLIC_VIEWPORT_PATH) return null;
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, { allow: "GET" });
  }

  if (!(await finderRequestAllowed(request, env, "public-finder"))) {
    return jsonResponse({ error: "Too many viewport requests. Please try again shortly." }, 429, {
      "retry-after": "60",
    });
  }
  if (url.searchParams.get("coverage") === "true") return publicFinderCoverage(env);
  if (url.searchParams.get("operators") === "true") {
    if (!finderProviderAllowed(env))
      return jsonResponse({ error: "Operator catalog unavailable." }, 503);
    try {
      if (env.PUBLIC_FINDER_PROVIDER === "neon") return await neonPublicRpc(env, "operators");
      const origin = environmentValue(env, "SUPABASE_URL");
      const key = environmentValue(env, "SUPABASE_PUBLISHABLE_KEY");
      if (!origin || !key) return jsonResponse([], 503);
      const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
      if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
      const result = await fetch(`${origin}/rest/v1/rpc/power_finder_public_operators`, {
        method: "POST",
        headers,
        body: "{}",
        signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) return jsonResponse([], 502);
      const data: unknown = await result.json();
      if (!Array.isArray(data) || data.length > 5000) return jsonResponse([], 502);
      return jsonResponse(data, 200, { "cache-control": "public, max-age=60, s-maxage=300" });
    } catch {
      return jsonResponse([], 502);
    }
  }

  let parameters: ViewportParameters;
  try {
    parameters = parsePublicViewportRequest(url);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid viewport." },
      400,
    );
  }

  const supabaseUrl = environmentValue(env, "SUPABASE_URL");
  const publishableKey = environmentValue(env, "SUPABASE_PUBLISHABLE_KEY");
  if (
    !finderProviderAllowed(env) ||
    (!neonFinderConfigured(env) && (!supabaseUrl || !publishableKey))
  ) {
    return jsonResponse({ error: "Public Finder data is temporarily unavailable." }, 503);
  }

  const viewportCacheUrl = normalizedCacheUrl(url, parameters);
  viewportCacheUrl.searchParams.set("provider", finderCachePartition(env));
  const cacheRequest = new Request(viewportCacheUrl, { method: "GET" });
  const cache =
    typeof caches === "undefined" ? null : (caches as CacheStorage & { default: Cache }).default;
  const cached = await cache?.match(cacheRequest);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = {
      apikey: publishableKey ?? "",
      "content-type": "application/json",
    };
    if (publishableKey?.startsWith("eyJ")) headers.authorization = `Bearer ${publishableKey}`;
    const rankingOnly = url.searchParams.get("ranking") === "true";
    const originUrl = `${supabaseUrl}/rest/v1/rpc/${rankingOnly ? "power_finder_public_candidate_nodes" : "power_finder_public_viewport"}`;
    const requestOptions = {
      method: "POST",
      headers,
      body: JSON.stringify({
        west: parameters.west,
        south: parameters.south,
        east: parameters.east,
        north: parameters.north,
        ...(rankingOnly
          ? { max_features: 1000 }
          : {
              include_generation: parameters.includeGeneration,
              include_storage: parameters.includeStorage,
              max_features: 2500,
            }),
      }),
      signal: controller.signal,
    } satisfies RequestInit;
    let response =
      env.PUBLIC_FINDER_PROVIDER === "neon"
        ? await neonPublicRpc(env, "viewport", [
            parameters.west,
            parameters.south,
            parameters.east,
            parameters.north,
            parameters.includeGeneration,
            parameters.includeStorage,
            rankingOnly,
          ])
        : await fetch(originUrl, requestOptions);
    if (
      env.PUBLIC_FINDER_PROVIDER !== "neon" &&
      response.status >= 500 &&
      !controller.signal.aborted
    ) {
      response = await fetch(originUrl, requestOptions);
    }
    if (!response.ok) {
      console.error(`Public Finder origin returned ${response.status}.`);
      const fallback =
        env.PUBLIC_FINDER_PROVIDER === "neon"
          ? null
          : await acceptedStaticFallback(url, env, parameters);
      if (fallback) return fallback;
      return jsonResponse({ error: "Public Finder data is temporarily unavailable." }, 502);
    }
    const responseBody = await response.text();
    if (responseBody.length > 12_000_000) {
      return jsonResponse({ error: "Public Finder response exceeded the safe limit." }, 502);
    }
    let publicBody = responseBody;
    try {
      const payload = JSON.parse(responseBody) as {
        metadata?: Record<string, unknown> & { record_count?: number };
      };
      if (payload.metadata) {
        if (env.PUBLIC_FINDER_PROVIDER !== "neon")
          payload.metadata.published_at_basis = "query_time";
        payload.metadata.queried_at = new Date().toISOString();
        payload.metadata.retrieval_capped =
          Number(payload.metadata.record_count ?? 0) >= (rankingOnly ? 1000 : 2500);
        payload.metadata.coverage_status =
          Number(payload.metadata.record_count ?? 0) > 0 ? "accepted_partial" : "unavailable";
        publicBody = JSON.stringify(payload);
      }
    } catch {
      return jsonResponse({ error: "Public Finder origin returned invalid data." }, 502);
    }
    const publicResponse = new Response(publicBody, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=60, s-maxage=${CACHE_SECONDS}, stale-if-error=3600`,
        "x-content-type-options": "nosniff",
        "x-gridpulse-data-mode": "live-public-release",
      },
    });
    if (cache) {
      const cacheWrite = cache.put(cacheRequest, publicResponse.clone());
      if (context.waitUntil) context.waitUntil(cacheWrite);
      else await cacheWrite;
    }
    return publicResponse;
  } catch {
    console.error("Public Finder origin failed.");
    const fallback =
      env.PUBLIC_FINDER_PROVIDER === "neon"
        ? null
        : await acceptedStaticFallback(url, env, parameters);
    if (fallback) return fallback;
    return jsonResponse({ error: "Public Finder data is temporarily unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function handlePublicPowerFinderTileRequest(
  request: Request,
  env: PublicFinderEnv,
  context: ExecutionContextLike = {},
) {
  const requestUrl = new URL(request.url);
  const match = requestUrl.pathname.match(PUBLIC_TILE_PATTERN);
  if (!match) return null;
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, { allow: "GET" });
  }
  const [z, x, y] = match.slice(1).map(Number);
  const registryOnly = requestUrl.searchParams.get("content") === "registry";
  const includeGeneration = requestUrl.searchParams.get("generation") !== "false";
  const includeStorage = requestUrl.searchParams.get("storage") !== "false";
  if (z < 4 || z > 16 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return jsonResponse({ error: "Invalid tile coordinate." }, 400);
  }
  const supabaseUrl = environmentValue(env, "SUPABASE_URL");
  const publishableKey = environmentValue(env, "SUPABASE_PUBLISHABLE_KEY");
  if (
    !finderProviderAllowed(env) ||
    (!neonFinderConfigured(env) && (!supabaseUrl || !publishableKey))
  ) {
    return jsonResponse({ error: "Public Finder data is temporarily unavailable." }, 503);
  }
  if (!(await finderRequestAllowed(request, env, "finder-tile")))
    return jsonResponse({ error: "Too many tile requests." }, 429, { "retry-after": "60" });
  const cacheUrl = new URL(requestUrl.pathname, requestUrl.origin);
  cacheUrl.searchParams.set("release", TILE_CACHE_RELEASE);
  cacheUrl.searchParams.set("provider", finderCachePartition(env));
  cacheUrl.searchParams.set("content", registryOnly ? "registry" : "grid");
  cacheUrl.searchParams.set("generation", String(includeGeneration));
  cacheUrl.searchParams.set("storage", String(includeStorage));
  const cacheRequest = new Request(cacheUrl, { method: "GET" });
  const cache =
    typeof caches === "undefined" ? null : (caches as CacheStorage & { default: Cache }).default;
  const cached = await cache?.match(cacheRequest);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("x-gridpulse-cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }
  const headers: Record<string, string> = {
    apikey: publishableKey ?? "",
    "content-type": "application/json",
  };
  if (publishableKey?.startsWith("eyJ")) headers.authorization = `Bearer ${publishableKey}`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const rpc = registryOnly ? "power_finder_public_registry_tile" : "power_finder_public_tile";
    const response =
      env.PUBLIC_FINDER_PROVIDER === "neon"
        ? await neonPublicRpc(env, "tile", [
            z,
            x,
            y,
            registryOnly,
            includeGeneration,
            includeStorage,
          ])
        : await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              z,
              x,
              y,
              include_generation: includeGeneration,
              include_storage: includeStorage,
            }),
            signal: controller.signal,
          });
    if (!response.ok) return jsonResponse({ error: "Tile origin unavailable." }, 502);
    const encoded = (await response.json()) as string;
    if (typeof encoded !== "string" || !encoded.startsWith("\\x")) {
      return jsonResponse({ error: "Tile origin returned invalid data." }, 502);
    }
    const hex = encoded.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < hex.length; index += 2) {
      bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
    }
    const publicResponse = new Response(bytes, {
      headers: {
        "content-type": "application/vnd.mapbox-vector-tile",
        "cache-control": `public, max-age=60, s-maxage=${TILE_EDGE_CACHE_SECONDS}, stale-if-error=300`,
        "x-content-type-options": "nosniff",
        "x-gridpulse-cache": "MISS",
        "server-timing": `tile-origin;dur=${Date.now() - startedAt}`,
      },
    });
    if (cache) {
      const cacheWrite = cache.put(cacheRequest, publicResponse.clone());
      if (context.waitUntil) context.waitUntil(cacheWrite);
      else await cacheWrite;
    }
    return publicResponse;
  } catch {
    return jsonResponse({ error: "Public Finder tile is temporarily unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
