// Live market data layer. Reads from the `market_data_latest` view
// (one row per symbol, most recent snapshot). Public anon SELECT.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MarketDataPoint {
  id: string;
  symbol: string;
  kind: "stock" | "commodity" | "index" | "metric";
  label: string;
  value: number;
  unit: string;
  currency: string | null;
  changeAbs: number | null;
  changePct: number | null;
  sourceName: string;
  sourceType: "api" | "manual" | "rss" | "seed";
  verificationStatus: "verified" | "unverified" | "demo";
  capturedAt: string;
}

type Row = {
  id: string;
  symbol: string;
  kind: string;
  label: string;
  value: number | string;
  unit: string;
  currency: string | null;
  change_abs: number | string | null;
  change_pct: number | string | null;
  source_name: string;
  source_type: string;
  verification_status: string;
  captured_at: string;
};

function toNumOrNull(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: Row): MarketDataPoint {
  return {
    id: r.id,
    symbol: r.symbol,
    kind: r.kind as MarketDataPoint["kind"],
    label: r.label,
    value: Number(r.value),
    unit: r.unit,
    currency: r.currency,
    changeAbs: toNumOrNull(r.change_abs),
    changePct: toNumOrNull(r.change_pct),
    sourceName: r.source_name,
    sourceType: r.source_type as MarketDataPoint["sourceType"],
    verificationStatus: r.verification_status as MarketDataPoint["verificationStatus"],
    capturedAt: r.captured_at,
  };
}

export async function fetchMarketData(): Promise<MarketDataPoint[]> {
  // Cast: market_data_latest is a view, not yet in generated types.
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  };
  const { data, error } = await client
    .from("market_data_latest")
    .select(
      "id,symbol,kind,label,value,unit,currency,change_abs,change_pct,source_name,source_type,verification_status,captured_at",
    );
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export const marketDataQuery = () =>
  queryOptions({
    queryKey: ["market-data-latest"],
    queryFn: fetchMarketData,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

// Formatting helpers
export function formatMarketValue(p: MarketDataPoint): string {
  const v = p.value;
  const symbol = p.currency === "USD" ? "$" : p.currency === "CNY" ? "¥" : p.currency === "HKD" ? "HK$" : "";
  if (p.unit.startsWith("USD/kWh") || p.unit === "USD/kWh DC") {
    return `$${v.toFixed(0)}/kWh${p.unit.endsWith("DC") ? " DC" : ""}`;
  }
  if (p.kind === "stock") {
    return `${symbol}${v.toFixed(2)}`;
  }
  return `${symbol}${v.toLocaleString()} ${p.unit}`.trim();
}

export function formatDelta(p: MarketDataPoint): { text: string; positive: boolean } | null {
  if (p.changePct === null && p.changeAbs === null) return null;
  const pct = p.changePct;
  if (pct !== null) {
    const positive = pct >= 0;
    return { text: `${positive ? "+" : ""}${pct.toFixed(2)}%`, positive };
  }
  const abs = p.changeAbs as number;
  return { text: `${abs >= 0 ? "+" : ""}${abs.toFixed(2)}`, positive: abs >= 0 };
}
