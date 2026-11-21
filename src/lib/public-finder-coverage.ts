import type { PublicFinderEnv } from "./public-power-finder-api";

/** Existing read-only governed release RPC. No acceptance is inferred from query capability. */
export async function publicFinderCoverage(env: PublicFinderEnv): Promise<Response> {
  const origin = env.SUPABASE_URL || env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!origin || !key)
    return Response.json({ coverage_status: "unavailable", releases: [] }, { status: 503 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
    if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
    const response = await fetch(`${origin}/rest/v1/rpc/power_finder_public_coverage`, {
      method: "POST",
      headers,
      body: "{}",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Coverage unavailable");
    const payload = (await response.json()) as { coverage_status?: string; releases?: unknown[] };
    if (
      !["national_accepted", "partial", "unavailable"].includes(payload.coverage_status ?? "") ||
      !Array.isArray(payload.releases)
    )
      throw new Error("Invalid coverage");
    return Response.json(payload, {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json({ coverage_status: "unavailable", releases: [] }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
