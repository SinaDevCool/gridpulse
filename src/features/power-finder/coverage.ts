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
    status: "accepted",
    bounds: [5.866, 47.27, 15.042, 55.059],
    center: [10.45, 51.16],
    zoom: 7.6,
    topology: true,
    registeredAssets: true,
    publishedDemandCapacity: false,
    lastAcceptedAt: "2026-08-10T00:00:00Z",
    evidenceBoundary:
      "Accepted Germany-wide OSM topology and MaStR asset context; demand headroom is not established.",
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
  ...([
    ["DE-BW", "Baden-Württemberg", [7.51, 47.53, 10.5, 49.79], [9.05, 48.66]],
    ["DE-BY", "Bavaria", [8.98, 47.27, 13.84, 50.56], [11.43, 48.92]],
    ["DE-BE", "Berlin", [13.09, 52.34, 13.76, 52.68], [13.405, 52.52]],
    ["DE-HB", "Bremen", [8.48, 53.01, 8.99, 53.61], [8.8, 53.2]],
    ["DE-HH", "Hamburg", [9.73, 53.39, 10.33, 53.74], [10.0, 53.55]],
    ["DE-HE", "Hesse", [7.77, 49.39, 10.24, 51.66], [9.0, 50.53]],
    ["DE-MV", "Mecklenburg-Vorpommern", [10.59, 53.11, 14.42, 54.68], [12.5, 53.9]],
    ["DE-NI", "Lower Saxony", [6.65, 51.29, 11.6, 53.89], [9.12, 52.59]],
    ["DE-NW", "North Rhine-Westphalia", [5.86, 50.32, 9.46, 52.53], [7.66, 51.43]],
    ["DE-RP", "Rhineland-Palatinate", [6.12, 48.97, 8.51, 50.94], [7.32, 49.95]],
    ["DE-SL", "Saarland", [6.36, 49.11, 7.4, 49.64], [6.88, 49.38]],
    ["DE-SN", "Saxony", [11.87, 50.17, 15.04, 51.69], [13.45, 50.93]],
    ["DE-ST", "Saxony-Anhalt", [10.56, 50.94, 13.19, 53.04], [11.88, 51.99]],
    ["DE-SH", "Schleswig-Holstein", [8.06, 53.36, 11.31, 55.06], [9.69, 54.21]],
    ["DE-TH", "Thuringia", [9.88, 50.2, 12.65, 51.65], [11.26, 50.93]],
  ] as const).map(([regionCode, regionName, bounds, center]) => ({
    regionCode,
    regionName,
    status: "accepted" as const,
    bounds: [...bounds] as [number, number, number, number],
    center: [...center] as [number, number],
    zoom: regionCode === "DE-BE" || regionCode === "DE-HB" || regionCode === "DE-HH" ? 10 : 8.2,
    topology: true,
    registeredAssets: true,
    publishedDemandCapacity: false,
    lastAcceptedAt: "2026-08-10T00:00:00Z",
    evidenceBoundary:
      "Accepted Germany-wide OSM topology and MaStR asset context; demand headroom is not established.",
  })),
];

export async function loadPowerFinderCoverage(): Promise<PowerFinderCoverage[]> {
  if (isFinderMvp()) return fallbackCoverage;
  const { data, error } = await supabase.rpc("power_finder_coverage");
  if (error || !Array.isArray(data)) return fallbackCoverage;
  const published = data.map((row) => ({
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
  const publishedCodes = new Set(published.map((item) => item.regionCode));
  return [...published, ...fallbackCoverage.filter((item) => !publishedCodes.has(item.regionCode))];
}
