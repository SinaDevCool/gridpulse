import type {
  PowerFinderCollection,
  PowerFinderFeature,
  PowerFinderProperties,
} from "./fixture-data";

const publicPropertyKeys = [
  "kind",
  "name",
  "operator",
  "voltage_kv",
  "voltage_evidence_status",
  "max_voltage_kv",
  "status",
  "evidence_class",
  "capacity_state",
  "exact_mw",
  "band_min_mw",
  "band_max_mw",
  "confidence_grade",
  "capacity_published_at",
  "source_url",
  "site_kind",
  "area_ha",
  "planning_status",
  "technology",
  "generation_group",
  "net_capacity_mw",
  "storage_energy_mwh",
  "generation_mw_20km",
  "storage_mw_20km",
  "storage_mwh_20km",
] as const satisfies readonly (keyof PowerFinderProperties)[];

function publicProperties(properties: PowerFinderProperties): PowerFinderProperties {
  const result: Partial<PowerFinderProperties> = {};
  for (const key of publicPropertyKeys) {
    const value = properties[key];
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result as PowerFinderProperties;
}

export function toPublicPowerFinderCollection(
  collection: PowerFinderCollection,
): PowerFinderCollection {
  return {
    type: "FeatureCollection",
    metadata: {
      title: collection.metadata.title,
      source_id: collection.metadata.source_id,
      publisher: collection.metadata.publisher,
      licence: collection.metadata.licence,
      attribution: collection.metadata.attribution,
      published_at: collection.metadata.published_at,
      geographic_scope: collection.metadata.geographic_scope,
      freshness: collection.metadata.freshness,
      artifact_sha256: collection.metadata.artifact_sha256,
      record_count: collection.features.length,
      available_kinds: collection.metadata.available_kinds,
      kind_counts: collection.metadata.kind_counts,
      evidence_boundary: collection.metadata.evidence_boundary,
    },
    features: collection.features.map(
      (feature): PowerFinderFeature => ({
        type: "Feature",
        id: feature.id,
        geometry: feature.geometry,
        properties: publicProperties(feature.properties),
      }),
    ),
  };
}
