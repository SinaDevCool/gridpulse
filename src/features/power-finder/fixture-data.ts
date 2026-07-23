import type { Feature, FeatureCollection, Geometry } from "geojson";

export type PowerFinderKind = "node" | "line" | "industrial_site";
export type PowerFinderEvidenceClass =
  | "official_operator"
  | "official_regulatory"
  | "official_public"
  | "open_mapping"
  | "test_fixture";

export type PowerFinderProperties = {
  kind: PowerFinderKind;
  name: string;
  operator?: string;
  voltage_kv?: number[];
  status?: string;
  evidence_class: PowerFinderEvidenceClass;
  capacity_state?:
    | "not_established"
    | "published_exact"
    | "published_band"
    | "feasible_no_mw"
    | "unavailable"
    | "document_derived"
    | "model_estimate";
  exact_mw?: number;
  band_min_mw?: number;
  band_max_mw?: number;
  confidence_grade?: string;
  capacity_published_at?: string;
  source_url?: string;
  site_kind?: string;
  area_ha?: number;
  planning_status?: string;
};

export type PowerFinderFeature = Feature<Geometry, PowerFinderProperties> & {
  id: string;
};

export type PowerFinderCollection = Omit<
  FeatureCollection<Geometry, PowerFinderProperties>,
  "features"
> & {
  metadata: {
    title: string;
    source_id: string;
    publisher: string;
    licence: string;
    attribution: string;
    published_at: string;
    geographic_scope: string | number[];
    freshness: string;
    artifact_sha256: string;
    record_count: number;
    evidence_boundary: string;
  };
  features: PowerFinderFeature[];
};

export function parsePowerFinderCollection(value: unknown): PowerFinderCollection {
  if (!value || typeof value !== "object") throw new Error("Power Finder data is missing.");
  const candidate = value as Partial<PowerFinderCollection>;
  if (candidate.type !== "FeatureCollection" || !Array.isArray(candidate.features)) {
    throw new Error("Power Finder data is not a GeoJSON FeatureCollection.");
  }
  if (!candidate.metadata || candidate.metadata.record_count !== candidate.features.length) {
    throw new Error("Power Finder artifact metadata does not match its features.");
  }
  for (const feature of candidate.features) {
    if (
      !feature.id ||
      !feature.geometry ||
      !feature.properties ||
      !["node", "line", "industrial_site"].includes(feature.properties.kind) ||
      ![
        "official_operator",
        "official_regulatory",
        "official_public",
        "open_mapping",
        "test_fixture",
      ].includes(feature.properties.evidence_class)
    ) {
      throw new Error("Power Finder artifact contains an invalid or unclassified feature.");
    }
  }
  return candidate as PowerFinderCollection;
}

export function pointCoordinates(feature: PowerFinderFeature): [number, number] | null {
  return feature.geometry.type === "Point"
    ? (feature.geometry.coordinates as [number, number])
    : null;
}

export function featureSummary(feature: PowerFinderFeature) {
  const properties = feature.properties;
  if (properties.kind === "node") {
    const capacity =
      properties.capacity_state === "published_exact" && properties.exact_mw !== undefined
        ? `${properties.exact_mw} MW published`
        : properties.capacity_state === "published_band" && properties.band_min_mw !== undefined
          ? `${properties.band_min_mw}–${properties.band_max_mw ?? "?"} MW published band`
          : "capacity not established";
    return `${properties.voltage_kv?.join(" / ") || "Unknown"} kV · ${capacity}`;
  }
  if (properties.kind === "industrial_site") {
    return `${properties.area_ha?.toFixed(1) ?? "Unknown"} ha · screening-only land context`;
  }
  return `${properties.voltage_kv?.join(" / ") ?? "Unknown"} kV screening corridor`;
}
