import { supabase } from "@/integrations/supabase/client";
import { isFinderMvp } from "@/config/product-mode";

export type CoverageStatus = "accepted" | "partial" | "planned" | "unavailable";

export interface PowerFinderCoverage {
  regionCode: string;
  regionName: string;
  status: CoverageStatus;
  bounds: [number, number, number, number];
  center: [number, number];
  zoom: number;
  topology: boolean;
  registeredAssets: boolean;
  publishedDemandCapacity: boolean;
  lastAcceptedAt: string | null;
  evidenceBoundary: string;
}

export const fallbackCoverage: PowerFinderCoverage[] = [
  {
    regionCode: "DE",
    regionName: "Germany",
    status: "partial",
    bounds: [5.866, 47.27, 15.042, 55.059],
    center: [10.45, 51.16],
    zoom: 5.4,
    topology: false,
    registeredAssets: false,
    publishedDemandCapacity: false,
    lastAcceptedAt: null,
    evidenceBoundary:
      "Currently available: Brandenburg. National coverage is planned; only accepted regional releases are displayed.",
  },
  {
    regionCode: "DE-BB",
    regionName: "Brandenburg",
    status: "accepted",
    bounds: [11.27, 51.36, 14.77, 53.56],
    center: [13.36, 52.31],
    zoom: 8.2,
    topology: true,
    registeredAssets: true,
    publishedDemandCapacity: false,
    lastAcceptedAt: "2026-07-23T00:00:00Z",
    evidenceBoundary:
      "Accepted OSM topology and MaStR asset context; demand headroom is not established.",
  },
];

export async function loadPowerFinderCoverage(): Promise<PowerFinderCoverage[]> {
  if (isFinderMvp()) return fallbackCoverage;
  const { data, error } = await supabase.rpc("power_finder_coverage");
  if (error || !Array.isArray(data)) return fallbackCoverage;
  return data.map((row) => ({
    regionCode: row.region_code,
    regionName: row.region_name,
    status: row.status,
    bounds: row.bounds,
    center: row.center,
    zoom: row.zoom,
    topology: row.topology,
    registeredAssets: row.registered_assets,
    publishedDemandCapacity: row.published_demand_capacity,
    lastAcceptedAt: row.last_accepted_at,
    evidenceBoundary: row.evidence_boundary,
  }));
}
