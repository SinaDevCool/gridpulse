// Server-only proxy for Ember Energy's public electricity API. All requests
// run inside the Worker to bypass browser CORS (Ember does not send
// Access-Control-Allow-Origin: *). Client code calls these functions via
// TanStack's typed RPC — never fetch api.ember-energy.org from the browser.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EMBER_BASE = "https://api.ember-energy.org/v1";
const USER_AGENT = "GridPulseBot/1.0 (+https://gridpulseinsights.com)";

async function emberFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${EMBER_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ember API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Foundational endpoint: fetch electricity generation / demand for a country
// by ISO-3166 alpha-2 code. Placeholder — Ember's real path & query shape can
// be filled in once the exact resource is chosen.
export const fetchEmberCountryProfile = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        countryCode: z.string().regex(/^[A-Z]{2}$/, "ISO-3166 alpha-2 uppercase"),
        year: z.number().int().gte(2000).lte(2100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // TODO: replace with the specific Ember resource path once selected
    // (e.g. `/electricity/generation?country=${data.countryCode}&year=...`).
    const qs = new URLSearchParams({ country: data.countryCode });
    if (data.year) qs.set("year", String(data.year));
    const payload = (await emberFetch(`/electricity/generation?${qs.toString()}`)) as Record<string, unknown>;
    return { ok: true as const, countryCode: data.countryCode, payload };
  });

// Health check for the proxy — useful for admin diagnostics.
export const pingEmber = createServerFn({ method: "GET" }).handler(async () => {
  const started = Date.now();
  try {
    await emberFetch("/status");
    return { ok: true as const, latencyMs: Date.now() - started };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, latencyMs: Date.now() - started, error: msg };
  }
});
