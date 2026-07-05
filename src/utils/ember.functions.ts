// Server-only proxy for Ember Energy's public electricity API. All requests
// run inside the Worker to bypass browser CORS (Ember does not send
// Access-Control-Allow-Origin: *). Client code calls these functions via
// TanStack's typed RPC — never fetch api.ember-energy.org from the browser.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMBER_BASE = "https://api.ember-energy.org/v1";
const USER_AGENT = "GridPulseBot/1.0 (+https://gridpulseinsights.com)";

// ISO alpha-2 → Ember alpha-3 mapping (extend as more countries wire up).
const ISO2_TO_ISO3: Record<string, string> = {
  DE: "DEU",
  US: "USA",
  GB: "GBR",
  FR: "FRA",
  ES: "ESP",
  IT: "ITA",
  CN: "CHN",
  IN: "IND",
  JP: "JPN",
  AU: "AUS",
};

type EmberRow = {
  entity: string;
  entity_code: string;
  date: string;
  series: string;
  generation_twh: number | null;
  share_of_generation_pct: number | null;
};

type EmberResponse = {
  data: EmberRow[];
  stats?: unknown;
};

async function emberFetch(path: string): Promise<EmberResponse> {
  const apiKey = process.env.EMBER_API_KEY;
  if (!apiKey) throw new Error("EMBER_API_KEY is not configured");
  const url = new URL(path.startsWith("http") ? path : `${EMBER_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString(), {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ember API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as EmberResponse;
}

// Read-only fetch of Ember yearly generation mix by ISO-3166 alpha-2 code.
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
    const iso3 = ISO2_TO_ISO3[data.countryCode];
    if (!iso3) throw new Error(`No Ember mapping for country ${data.countryCode}`);
    const year = data.year ?? new Date().getUTCFullYear() - 1;
    const qs = new URLSearchParams({
      entity_code: iso3,
      is_aggregate_series: "false",
      start_date: String(year),
    });
    const payload = await emberFetch(`/electricity-generation/yearly?${qs.toString()}`);
    return { ok: true as const, countryCode: data.countryCode, year, rows: payload.data };
  });

// Admin-only: fetch Ember yearly generation for a country and upsert each
// series (Solar, Wind, Nuclear, …) into `market_data` with verified provenance.
export const syncEmberCountryGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        countryCode: z.string().regex(/^[A-Z]{2}$/),
        year: z.number().int().gte(2000).lte(2100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const iso3 = ISO2_TO_ISO3[data.countryCode];
    if (!iso3) return { ok: false as const, error: `No Ember mapping for ${data.countryCode}` };
    const year = data.year ?? new Date().getUTCFullYear() - 1;

    const started = Date.now();
    try {
      const qs = new URLSearchParams({
        entity_code: iso3,
        is_aggregate_series: "false",
        start_date: String(year),
      });
      const payload = await emberFetch(`/electricity-generation/yearly?${qs.toString()}`);
      // Keep the freshest year per series.
      const latestBySeries = new Map<string, EmberRow>();
      for (const row of payload.data) {
        const existing = latestBySeries.get(row.series);
        if (!existing || row.date > existing.date) latestBySeries.set(row.series, row);
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const nowIso = new Date().toISOString();
      const capturedAt = new Date(`${year}-12-31T00:00:00Z`).toISOString();
      const rowsToInsert = Array.from(latestBySeries.values())
        .filter((r) => typeof r.generation_twh === "number")
        .map((r) => {
          const seriesSlug = r.series.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
          const symbol = `${data.countryCode}-${seriesSlug}-GEN`;
          return {
            symbol,
            kind: "metric",
            label: `${r.entity} ${r.series} generation (${r.date})`,
            value: r.generation_twh as number,
            unit: "TWh",
            currency: null,
            change_abs: null,
            change_pct: r.share_of_generation_pct ?? null,
            country_code: data.countryCode,
            source_name: "Ember Energy",
            source_type: "api",
            verification_status: "verified",
            captured_at: capturedAt,
            fetched_at: nowIso,
            metadata: {
              provider: "ember-energy",
              entity_code: iso3,
              year: r.date,
              series: r.series,
              share_of_generation_pct: r.share_of_generation_pct,
            },
          };
        });

      if (rowsToInsert.length === 0) {
        return { ok: true as const, upserted: 0, durationMs: Date.now() - started, year };
      }

      const symbols = rowsToInsert.map((r) => r.symbol);
      const { error: delError } = await supabaseAdmin
        .from("market_data")
        .delete()
        .eq("country_code", data.countryCode)
        .in("symbol", symbols);
      if (delError) throw new Error(delError.message);

      const { error: insError } = await supabaseAdmin.from("market_data").insert(rowsToInsert);
      if (insError) throw new Error(insError.message);

      return {
        ok: true as const,
        upserted: rowsToInsert.length,
        durationMs: Date.now() - started,
        year,
        countryCode: data.countryCode,
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      };
    }
  });

// Health check for the proxy — useful for admin diagnostics.
export const pingEmber = createServerFn({ method: "GET" }).handler(async () => {
  const started = Date.now();
  try {
    await emberFetch("/electricity-generation/yearly?entity_code=DEU&is_aggregate_series=true&start_date=2024");
    return { ok: true as const, latencyMs: Date.now() - started };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, latencyMs: Date.now() - started, error: msg };
  }
});
