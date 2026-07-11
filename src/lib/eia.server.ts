// Server-only: compliant U.S. EIA API v2 client for electricity operating
// capacity data. Uses the official electric-power-operational-data node,
// pins length below the 5000-observation single-call cap, and coerces the
// string-typed value fields into sanitized numbers on ingest.
//
// Docs: https://www.eia.gov/opendata/documentation.php (v2)
// Node: /v2/electricity/electric-power-operational-data/data/

const EIA_BASE = "https://api.eia.gov/v2/electricity/electric-power-operational-data/data/";
const LENGTH = 2000; // stays comfortably under the 5000 obs single-call cap

export interface EiaRow {
  period: string;
  stateid: string | null;
  stateDescription: string | null;
  fueltypeid: string | null;
  value: number; // parsed from string per EIA v2 spec
  unit: string;
}

interface EiaRawRow {
  period: string;
  stateid?: string;
  stateDescription?: string;
  fueltypeid?: string;
  value: string | number | null;
  "value-units"?: string;
}
interface EiaResponse {
  response?: { data?: EiaRawRow[] };
}

export interface EiaFetchOptions {
  frequency?: "monthly" | "quarterly" | "annual";
  facets?: Record<string, string[]>;
  start?: string;
  end?: string;
}

export async function fetchEiaOperationalData(
  opts: EiaFetchOptions = {},
): Promise<EiaRow[]> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error("EIA_API_KEY not configured");

  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  params.set("frequency", opts.frequency ?? "monthly");
  params.append("data[0]", "value");
  params.set("length", String(LENGTH));
  if (opts.start) params.set("start", opts.start);
  if (opts.end) params.set("end", opts.end);
  for (const [k, vs] of Object.entries(opts.facets ?? {})) {
    for (const v of vs) params.append(`facets[${k}][]`, v);
  }

  const res = await fetch(`${EIA_BASE}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`EIA v2 ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as EiaResponse;
  const rows = json.response?.data ?? [];

  // Strings-to-numbers mapper: EIA v2 numerics arrive as JSON strings.
  return rows.map((row) => {
    const capacityValue = parseFloat(String(row.value)) || 0;
    return {
      period: row.period,
      stateid: row.stateid ?? null,
      stateDescription: row.stateDescription ?? null,
      fueltypeid: row.fueltypeid ?? null,
      value: capacityValue,
      unit: row["value-units"] ?? "",
    };
  });
}
