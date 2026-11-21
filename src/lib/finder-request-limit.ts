import type { PublicFinderEnv } from "./public-power-finder-api";

/** CF supplies this address at the edge. Never retain raw client addresses in limiter keys. */
export async function finderRequestAllowed(
  request: Request,
  env: PublicFinderEnv,
  operation: string,
) {
  if (!env.PUBLIC_FINDER_RATE_LIMITER) return true;
  const address = request.headers.get("cf-connecting-ip") ?? "unidentified";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  const client = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return (
    await env.PUBLIC_FINDER_RATE_LIMITER.limit({
      key: `${operation}:${new URL(request.url).hostname}:${client}`,
    })
  ).success;
}
