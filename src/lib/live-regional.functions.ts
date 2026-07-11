// Live regional capacity server function. Aggregates utility-scale battery
// storage totals from live federal APIs (US EIA v2 + ENTSO-E) with per-region
// graceful fallbacks so the enterprise Markets dashboard never renders a
// blank state when a provider rate-limits or times out.
import { createServerFn } from "@tanstack/react-start";
import type { EuRegion } from "@/lib/eu-regions";

export type LiveFeedLabel =
  | "Live Feed: US EIA API v2"
  | "Live Feed: ENTSO-E System Data"
  | "Live Feed: SMARD Grid API"
  | "Fallback: Verified Registry Cache";

export interface LiveRegionEntry {
  region: EuRegion;
  mw: number;
  sourceLabel: LiveFeedLabel;
  asOf: string;
}

export interface LiveRegionalPayload {
  regions: LiveRegionEntry[];
  activeSources: LiveFeedLabel[];
  fetchedAt: string;
}

// ENTSO-E EIC domain codes for the two headline European bidding zones.
const EIC_DE = "10Y1001A1001A83F";
const EIC_GB = "10YGB----------A";

function ymdhm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

async function fetchEiaNorthAmericaMw(): Promise<LiveRegionEntry | null> {
  try {
    const { fetchEiaOperationalData } = await import("@/lib/eia.server");
    const rows = await fetchEiaOperationalData({
      frequency: "monthly",
      facets: { fueltypeid: ["BAT"], location: ["US"] },
    });
    if (rows.length === 0) return null;
    // Take the most recent monthly period across the batch.
    const latestPeriod = rows.reduce(
      (acc, r) => (r.period > acc ? r.period : acc),
      rows[0].period,
    );
    const mw = rows
      .filter((r) => r.period === latestPeriod)
      .reduce((s, r) => s + (parseFloat(String(r.value)) || 0), 0);
    if (!Number.isFinite(mw) || mw <= 0) return null;
    return {
      region: "North America (US/CA)",
      mw: Math.round(mw),
      sourceLabel: "Live Feed: US EIA API v2",
      asOf: latestPeriod,
    };
  } catch (e) {
    console.error("EIA live fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function fetchEntsoeEuropeMw(): Promise<LiveRegionEntry | null> {
  try {
    const { fetchInstalledBatteryCapacity } = await import("@/lib/entsoe.server");
    const now = new Date();
    const start = new Date(now.getUTCFullYear(), 0, 1);
    const periodStart = ymdhm(start) + "";
    const periodEnd = ymdhm(now) + "";
    const [de, gb] = await Promise.all([
      fetchInstalledBatteryCapacity(EIC_DE, periodStart, periodEnd),
      fetchInstalledBatteryCapacity(EIC_GB, periodStart, periodEnd),
    ]);
    const series = [...(de as unknown[]), ...(gb as unknown[])];
    if (series.length === 0) return null;
    // ENTSO-E returns installed capacity nominally as MW; sum quantity fields.
    let mw = 0;
    for (const ts of series) {
      const t = ts as Record<string, unknown>;
      const raw =
        (t.quantity as string | number | undefined) ??
        ((t.Point as Array<{ quantity?: string | number }> | undefined)?.[0]?.quantity);
      const n = parseFloat(String(raw ?? "0")) || 0;
      mw += n;
    }
    if (!Number.isFinite(mw) || mw <= 0) return null;
    return {
      region: "Europe & UK (EU/UK)",
      mw: Math.round(mw),
      sourceLabel: "Live Feed: ENTSO-E System Data",
      asOf: new Date().toISOString().slice(0, 10),
    };
  } catch (e) {
    console.error("ENTSO-E live fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export const getLiveRegionalCapacity = createServerFn({ method: "GET" }).handler(
  async (): Promise<LiveRegionalPayload> => {
    const [na, eu] = await Promise.all([
      fetchEiaNorthAmericaMw(),
      fetchEntsoeEuropeMw(),
    ]);
    const regions = [na, eu].filter((x): x is LiveRegionEntry => x !== null);
    const activeSources = Array.from(new Set(regions.map((r) => r.sourceLabel)));
    return {
      regions,
      activeSources,
      fetchedAt: new Date().toISOString(),
    };
  },
);
