import type { PowerFinderCollection, PowerFinderKind } from "@/features/power-finder/fixture-data";

export type MapSourceHealth = "live" | "partial" | "fallback" | "unavailable";
export type MapCoverageState =
  | "accepted_complete"
  | "accepted_partial"
  | "regional_only"
  | "modelled"
  | "not_covered"
  | "unknown";

export type MapRuntimeSourceStatus = Partial<
  Record<"grid" | "registry", "idle" | "loading" | "ready" | "error">
>;

export type MapSourceSummary = {
  sourceId: string;
  publisher: string;
  datasetName: string;
  licence: string;
  publishedAt: string | null;
  geographicScope: string | number[];
  health: MapSourceHealth;
  evidenceBoundary: string;
  availableKinds: readonly PowerFinderKind[];
  kindCounts: Partial<Record<PowerFinderKind, number>>;
  voltageCoverage: Record<string, MapCoverageState>;
  layerSources: Record<
    "grid" | "registry",
    { publisher: string; datasetName: string; sourceUrl: string; licence: string }
  >;
};

export const GERMANY_MAP_SOURCES = {
  grid: {
    publisher: "OpenStreetMap contributors",
    datasetName: "Mapped German power infrastructure",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    licence: "ODbL 1.0",
  },
  registry: {
    publisher: "Bundesnetzagentur",
    datasetName: "Marktstammdatenregister (MaStR)",
    sourceUrl: "https://www.marktstammdatenregister.de/MaStR/Datendownload",
    licence: "Datenlizenz Deutschland – Namensnennung – Version 2.0",
  },
} as const;

const ALL_KINDS: readonly PowerFinderKind[] = [
  "node",
  "line",
  "industrial_site",
  "generation_asset",
  "storage_asset",
];

function inferHealth(
  collection: PowerFinderCollection,
  runtime: MapRuntimeSourceStatus,
): MapSourceHealth {
  const registryReady = runtime.registry === "ready";
  const gridReady = runtime.grid === "ready";
  if (registryReady || gridReady)
    return collection.metadata.coverage_status === "accepted_partial" ? "partial" : "live";
  if (collection.metadata.coverage_status === "accepted_static_fallback") return "fallback";
  if (collection.metadata.coverage_status === "unavailable") return "unavailable";
  return "partial";
}

export function resolveMapSourceSummary(
  collection: PowerFinderCollection,
  runtime: MapRuntimeSourceStatus = {},
): MapSourceSummary {
  const availableKinds = new Set(collection.metadata.available_kinds ?? ALL_KINDS);
  if (runtime.grid === "ready") {
    availableKinds.add("node");
    availableKinds.add("line");
  }
  if (runtime.registry === "ready") {
    availableKinds.add("generation_asset");
    availableKinds.add("storage_asset");
  }
  const voltageCoverage = collection.metadata.voltage_coverage ?? {
    ehv: "accepted_partial",
    "220kv": "accepted_partial",
    "110kv": "accepted_partial",
    distribution: "accepted_partial",
    unknown: "accepted_partial",
  };
  return {
    sourceId: collection.metadata.source_id,
    publisher: collection.metadata.publisher,
    datasetName: collection.metadata.title,
    licence: collection.metadata.licence,
    publishedAt: collection.metadata.published_at || null,
    geographicScope: collection.metadata.geographic_scope,
    health: inferHealth(collection, runtime),
    evidenceBoundary: collection.metadata.evidence_boundary,
    availableKinds: [...availableKinds],
    kindCounts: collection.metadata.kind_counts ?? {},
    voltageCoverage,
    layerSources: GERMANY_MAP_SOURCES,
  };
}

export function sourceSupportsKind(summary: MapSourceSummary, kind: PowerFinderKind) {
  return summary.availableKinds.includes(kind);
}

export function sourceStatusLabel(
  summary: MapSourceSummary,
  focus: "all" | "grid" | "registry" = "all",
) {
  const prefix =
    summary.health === "live"
      ? "Live"
      : summary.health === "partial"
        ? "Accepted partial"
        : summary.health === "fallback"
          ? "Accepted fallback"
          : "Unavailable";
  if (focus === "grid") return `${summary.layerSources.grid.publisher} · ${prefix}`;
  if (focus === "registry") return `${summary.layerSources.registry.publisher} · MaStR · ${prefix}`;
  return `German public map · ${prefix}`;
}
