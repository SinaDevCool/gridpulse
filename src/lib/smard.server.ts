// Server-only: fetches Germany's official day-ahead wholesale electricity
// spot price series from the Bundesnetzagentur SMARD Transparency API and
// upserts snapshots into `market_data` as verified DE-SPOT-PRICE rows.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SMARD_BASE = "https://www.smard.de/app/chart_data";
const FILTER = "4169"; // Großhandelspreise (Day-Ahead) DE/LU
const REGION = "DE";
const RESOLUTION = "hour";
const USER_AGENT = "GridPulseBot/1.0 (+https://gridpulseinsights.com)";

interface IndexResponse {
  timestamps: number[];
}
interface SeriesResponse {
  series: [number, number | null][];
}

async function smardGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SMARD ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface SmardIngestResult {
  ok: true;
  latestTimestamp: string;
  price: number;
  points: number;
  durationMs: number;
}

export async function runSmardPricePipeline(): Promise<SmardIngestResult> {
  const started = Date.now();
  const index = await smardGet<IndexResponse>(
    `${SMARD_BASE}/${FILTER}/${REGION}/index_${RESOLUTION}.json`,
  );
  const timestamps = (index.timestamps ?? []).slice().sort((a, b) => a - b);
  if (timestamps.length === 0) throw new Error("SMARD index empty");
  const latest = timestamps[timestamps.length - 1];
  const series = await smardGet<SeriesResponse>(
    `${SMARD_BASE}/${FILTER}/${REGION}/${FILTER}_${REGION}_${RESOLUTION}_${latest}.json`,
  );

  const points = (series.series ?? []).filter(
    ([, v]) => typeof v === "number" && Number.isFinite(v),
  ) as [number, number][];
  if (points.length === 0) throw new Error("SMARD series has no numeric points");

  // Most-recent hour with data.
  const [tsMs, priceEurMwh] = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2][1] : null;
  const changeAbs = prev !== null ? priceEurMwh - prev : null;
  const changePct = prev !== null && prev !== 0 ? ((priceEurMwh - prev) / prev) * 100 : null;
  const capturedAt = new Date(tsMs).toISOString();
  const nowIso = new Date().toISOString();

  const row = {
    symbol: "DE-SPOT-PRICE",
    kind: "price",
    label: "Germany day-ahead wholesale power price",
    value: priceEurMwh,
    unit: "EUR/MWh",
    currency: "EUR",
    change_abs: changeAbs,
    change_pct: changePct,
    country_code: "DE",
    source_name: "Bundesnetzagentur SMARD",
    source_type: "api",
    verification_status: "verified",
    captured_at: capturedAt,
    fetched_at: nowIso,
    metadata: {
      provider: "smard",
      filter: FILTER,
      region: REGION,
      resolution: RESOLUTION,
      window_start_ts: latest,
    },
  };

  const { error: delErr } = await supabaseAdmin
    .from("market_data")
    .delete()
    .eq("symbol", row.symbol)
    .eq("captured_at", capturedAt);
  if (delErr) throw new Error(delErr.message);
  const { error: insErr } = await supabaseAdmin.from("market_data").insert(row);
  if (insErr) throw new Error(insErr.message);

  return {
    ok: true,
    latestTimestamp: capturedAt,
    price: priceEurMwh,
    points: points.length,
    durationMs: Date.now() - started,
  };
}
