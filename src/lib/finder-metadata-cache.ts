import {
  finderCachePartition,
  neonFinderConfigured,
  type NeonFinderEnv,
} from "./neon-finder-public";

/** Immutable public snapshot metadata, isolated by environment and admitted data hash. */
export async function cachedFinderMetadata(
  url: URL,
  env: NeonFinderEnv,
  kind: "coverage" | "operators",
  read: () => Promise<Response>,
  context: { waitUntil?: (promise: Promise<unknown>) => void } = {},
) {
  if (!neonFinderConfigured(env)) return read();
  const cache =
    typeof caches === "undefined" ? null : (caches as CacheStorage & { default: Cache }).default;
  if (!cache) return read();
  const key = new URL("/api/power-finder/viewport", url.origin);
  key.searchParams.set("metadata", kind);
  key.searchParams.set("provider", finderCachePartition(env));
  const request = new Request(key);
  const hit = await cache.match(request).catch(() => undefined);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set("x-gridpulse-cache", "HIT");
    return new Response(hit.body, { status: hit.status, headers });
  }
  const response = await read();
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=60, s-maxage=3600");
  headers.set("x-gridpulse-cache", "MISS");
  const published = new Response(response.body, { status: response.status, headers });
  const write = cache.put(request, published.clone()).catch(() => undefined);
  if (context.waitUntil) context.waitUntil(write);
  else await write;
  return published;
}
