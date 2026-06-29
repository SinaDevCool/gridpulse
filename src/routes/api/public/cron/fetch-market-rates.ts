import { createFileRoute } from "@tanstack/react-router";

// Cron-secured endpoint. Called hourly by pg_cron with the project's anon key
// in the `apikey` header. The /api/public/* prefix bypasses Lovable edge auth,
// so we enforce the apikey header to keep random callers out.
//
// Pulls real-time quotes from Finnhub (free tier) for grid-storage equities,
// then upserts a new market_data snapshot per symbol.

const FINNHUB_BASE = "https://finnhub.io/api/v1";

// Symbols to fetch from Finnhub. CATL (300750.SZ) and BYD (1211.HK) are not
// covered by Finnhub free tier — kept as manual entries seeded in the DB.
const STOCKS: { symbol: string; label: string; currency: string }[] = [
  { symbol: "TSLA", label: "Tesla", currency: "USD" },
  { symbol: "FLNC", label: "Fluence", currency: "USD" },
];

interface FinnhubQuote {
  c: number; // current
  d: number | null; // change abs
  dp: number | null; // change pct
  pc: number; // prev close
  t: number; // unix sec
}

async function fetchQuote(symbol: string, apiKey: string): Promise<FinnhubQuote> {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Finnhub ${symbol} returned ${res.status}`);
  const json = (await res.json()) as FinnhubQuote;
  if (!json || typeof json.c !== "number" || json.c === 0) {
    throw new Error(`Finnhub ${symbol} returned empty quote`);
  }
  return json;
}

export const Route = createFileRoute("/api/public/cron/fetch-market-rates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!expected || !apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const finnhubKey = process.env.FINNHUB_API_KEY;
        if (!finnhubKey) {
          return new Response(
            JSON.stringify({ ok: false, error: "FINNHUB_API_KEY not configured" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const results: Array<{ symbol: string; ok: boolean; value?: number; error?: string }> = [];
        const capturedAt = new Date().toISOString();

        for (const s of STOCKS) {
          try {
            const q = await fetchQuote(s.symbol, finnhubKey);
            const { error } = await supabaseAdmin.from("market_data").insert({
              symbol: s.symbol,
              kind: "stock",
              label: s.label,
              value: q.c,
              unit: s.currency,
              currency: s.currency,
              change_abs: q.d,
              change_pct: q.dp,
              source_name: "Finnhub",
              source_type: "api",
              verification_status: "verified",
              captured_at: capturedAt,
              metadata: { previous_close: q.pc, finnhub_t: q.t },
            });
            if (error) {
              // Unique-constraint race on (symbol, captured_at) is harmless.
              if (!error.message.toLowerCase().includes("duplicate")) {
                results.push({ symbol: s.symbol, ok: false, error: error.message });
                continue;
              }
            }
            results.push({ symbol: s.symbol, ok: true, value: q.c });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`Market fetch ${s.symbol} failed:`, msg);
            results.push({ symbol: s.symbol, ok: false, error: msg });
          }
        }

        const okCount = results.filter((r) => r.ok).length;
        return Response.json({
          ok: okCount > 0,
          updated: okCount,
          attempted: STOCKS.length,
          capturedAt,
          results,
        });
      },
    },
  },
});
