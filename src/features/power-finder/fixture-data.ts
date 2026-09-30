import type { Feature, FeatureCollection, Geometry } from "geojson";

export type PowerFinderKind =
  | "node"
  | "line"
  | "industrial_site"
  | "generation_asset"
  | "storage_asset";
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
  voltage_evidence_status?: "accepted" | "ambiguous" | "implausible" | "missing";
  max_voltage_kv?: number;
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
  source_published_at?: string;
  source_url?: string;
  site_kind?: string;
  area_ha?: number;
  planning_status?: string;
  technology?: string;
  generation_group?:
    | "solar"
    | "wind"
    | "biomass"
    | "hydro"
    | "geothermal"
    | "nuclear"
    | "gas"
    | "fossil_other"
    | "other"
    | "storage";
  net_capacity_mw?: number;
  storage_energy_mwh?: number;
  generation_mw_20km?: number;
  storage_mw_20km?: number;
  storage_mwh_20km?: number;
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
    available_kinds?: PowerFinderKind[];
    kind_counts?: Partial<Record<PowerFinderKind, number>>;
    coverage_status?: "accepted_partial" | "accepted_static_fallback" | "unavailable";
    voltage_coverage?: Partial<
      Record<
        "ehv" | "220kv" | "110kv" | "distribution" | "unknown",
        | "accepted_complete"
        | "accepted_partial"
        | "regional_only"
        | "modelled"
        | "not_covered"
        | "unknown"
      >
    >;
    evidence_boundary: string;
  };
  features: PowerFinderFeature[];
};

/**
 * A truthful, asset-free shell used while independent public map sources load.
 * It lets the shared vector-tile layers mount immediately without inventing
 * viewport features or coupling their availability to the GeoJSON endpoint.
 */
export function emptyGermanyPowerFinderCollection(): PowerFinderCollection {
  return {
    type: "FeatureCollection",
    metadata: {
      title: "Germany public grid context",
      source_id: "gridpulse-empty-map-shell",
      publisher: "GridPulse",
      licence: "No asset data",
      attribution: "No viewport assets loaded",
      published_at: "",
      geographic_scope: "Germany",
      freshness: "loading",
      artifact_sha256: "",
      record_count: 0,
      available_kinds: [],
      kind_counts: {},
      coverage_status: "unavailable",
      voltage_coverage: {
        ehv: "unknown",
        "220kv": "unknown",
        "110kv": "unknown",
        distribution: "unknown",
        unknown: "unknown",
      },
      evidence_boundary:
        "Empty loading shell. It contains no asset evidence and makes no capacity claim.",
    },
    features: [],
  };
}

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
      !["node", "line", "industrial_site", "generation_asset", "storage_asset"].includes(
        feature.properties.kind,
      ) ||
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
  return {
    ...(candidate as PowerFinderCollection),
    features: candidate.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        max_voltage_kv: Math.max(0, ...(feature.properties.voltage_kv ?? [])),
      },
    })),
  };
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
  if (properties.kind === "generation_asset") {
    return `${properties.net_capacity_mw?.toFixed(2) ?? "Unknown"} MW registered generation · not grid capacity`;
  }
  if (properties.kind === "storage_asset") {
    return `${properties.net_capacity_mw?.toFixed(2) ?? "Unknown"} MW / ${properties.storage_energy_mwh?.toFixed(2) ?? "Unknown"} MWh registered storage`;
  }
  return `${properties.voltage_kv?.join(" / ") ?? "Unknown"} kV screening corridor`;
}
