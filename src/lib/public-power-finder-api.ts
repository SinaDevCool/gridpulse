const PUBLIC_VIEWPORT_PATH = "/api/power-finder/viewport";
const PUBLIC_TILE_PATTERN = /^\/api\/power-finder\/tile\/(\d+)\/(\d+)\/(\d+)$/;
const CACHE_SECONDS = 300;
const TILE_CACHE_RELEASE = "20260812-capacity-clusters-v1";
const TILE_EDGE_CACHE_SECONDS = 2_592_000;

export type PublicFinderEnv = {
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
    cacheUrl.searchParams.set(name, value.toFixed(3));
  }
  cacheUrl.searchParams.set("generation", String(parameters.includeGeneration));
  cacheUrl.searchParams.set("storage", String(parameters.includeStorage));
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

  let parameters: ViewportParameters;
  try {
    parameters = parsePublicViewportRequest(url);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid viewport." },
      400,
    );
  }

  if (env.PUBLIC_FINDER_RATE_LIMITER) {
    const rateLimit = await env.PUBLIC_FINDER_RATE_LIMITER.limit({
      key: `public-finder:${url.hostname}`,
    });
    if (!rateLimit.success) {
      return jsonResponse({ error: "Too many viewport requests. Please try again shortly." }, 429, {
        "retry-after": "60",
      });
    }
  }

  const supabaseUrl = environmentValue(env, "SUPABASE_URL");
  const publishableKey = environmentValue(env, "SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) {
    return jsonResponse({ error: "Public Finder data is temporarily unavailable." }, 503);
  }

  const cacheRequest = new Request(normalizedCacheUrl(url, parameters), { method: "GET" });
  const cache =
    typeof caches === "undefined" ? null : (caches as CacheStorage & { default: Cache }).default;
  const cached = await cache?.match(cacheRequest);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = {
      apikey: publishableKey,
      "content-type": "application/json",
    };
    if (publishableKey.startsWith("eyJ")) headers.authorization = `Bearer ${publishableKey}`;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/power_finder_public_viewport`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        west: parameters.west,
        south: parameters.south,
        east: parameters.east,
        north: parameters.north,
        include_generation: parameters.includeGeneration,
        include_storage: parameters.includeStorage,
        max_features: 2500,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`Public Finder origin returned ${response.status}.`);
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
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Public Finder origin failed.");
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
  if (!supabaseUrl || !publishableKey) {
    return jsonResponse({ error: "Public Finder data is temporarily unavailable." }, 503);
  }
  const cacheUrl = new URL(requestUrl.pathname, requestUrl.origin);
  cacheUrl.searchParams.set("release", TILE_CACHE_RELEASE);
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
    apikey: publishableKey,
    "content-type": "application/json",
  };
  if (publishableKey.startsWith("eyJ")) headers.authorization = `Bearer ${publishableKey}`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const rpc = registryOnly ? "power_finder_public_registry_tile" : "power_finder_public_tile";
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
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
        "cache-control": `public, max-age=3600, s-maxage=${TILE_EDGE_CACHE_SECONDS}, stale-if-error=604800`,
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
