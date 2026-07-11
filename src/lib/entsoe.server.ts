// Server-only: compliant ENTSO-E Transparency Platform client.
// Explicitly requests JSON payloads (Accept: application/json) to bypass the
// platform's default XML response, and appends official documentation
// classification codes so utility-scale installed generation capacity is
// isolated correctly.
//
// Docs: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html

const ENTSOE_BASE = "https://web-api.tp.entsoe.eu/api";

// Official ENTSO-E document/process classification codes.
export const ENTSOE_DOC_TYPES = {
  installedCapacity: "A68", // Installed generation capacity per unit
  aggregatedGeneration: "A75",
  actualGeneration: "A73",
} as const;

// PsrType (production source type) codes from ENTSO-E documentation.
// B18 = "Battery storage", B10 = "Hydro Pumped Storage" — utility-scale filters.
export const ENTSOE_PSR_TYPES = {
  battery: "B18",
  pumpedHydro: "B10",
} as const;

export interface EntsoeFetchOptions {
  documentType: string;
  processType?: string;
  psrType?: string;
  in_Domain?: string; // EIC area code, e.g. "10Y1001A1001A83F" (DE)
  periodStart: string; // yyyyMMddHHmm
  periodEnd: string;
}

export async function fetchEntsoe<T = unknown>(opts: EntsoeFetchOptions): Promise<T> {
  const token = process.env.ENTSOE_API_KEY;
  if (!token) throw new Error("ENTSOE_API_KEY not configured");

  const params = new URLSearchParams();
  params.set("securityToken", token);
  params.set("documentType", opts.documentType);
  if (opts.processType) params.set("processType", opts.processType);
  if (opts.psrType) params.set("psrType", opts.psrType);
  if (opts.in_Domain) params.set("in_Domain", opts.in_Domain);
  params.set("periodStart", opts.periodStart);
  params.set("periodEnd", opts.periodEnd);

  const res = await fetch(`${ENTSOE_BASE}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ENTSO-E ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// Convenience helper: installed utility-scale battery storage capacity for
// a given EIC bidding zone. Returns [] gracefully when the API errors so
// callers can fall back to the local high-fidelity dataset without breaking
// the dashboard.
export async function fetchInstalledBatteryCapacity(
  eicDomain: string,
  periodStart: string,
  periodEnd: string,
): Promise<unknown[]> {
  try {
    const json = await fetchEntsoe<{ TimeSeries?: unknown[] } | { timeSeries?: unknown[] }>({
      documentType: ENTSOE_DOC_TYPES.installedCapacity,
      psrType: ENTSOE_PSR_TYPES.battery,
      in_Domain: eicDomain,
      periodStart,
      periodEnd,
    });
    const series =
      (json as { TimeSeries?: unknown[] }).TimeSeries ??
      (json as { timeSeries?: unknown[] }).timeSeries ??
      [];
    return series;
  } catch (e) {
    console.error("ENTSO-E capacity fetch failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
