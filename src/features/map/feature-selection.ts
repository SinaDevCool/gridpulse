import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap, Source } from "maplibre-gl";

import type {
  PowerFinderCollection,
  PowerFinderFeature,
  PowerFinderKind,
  PowerFinderProperties,
} from "@/features/power-finder/fixture-data";

import { type VisibleLayerCounts } from "@/components/product/power-finder-map-data";

import type { CalculatedCapacityNode } from "@/features/power-finder/calculated-capacity";

import { classifyCapacityOpportunity } from "@/features/power-finder/capacity-opportunity";

import type { CapacityMetric } from "@/features/power-finder/calculated-capacity";

export function isGeoJsonSource(source: Source | undefined): source is GeoJSONSource {
  return source?.type === "geojson";
}

const selectableKinds = new Set<PowerFinderKind>([
  "node",
  "line",
  "industrial_site",
  "generation_asset",
  "storage_asset",
]);

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function renderedFeatureToPowerFinderFeature(
  rendered: NonNullable<MapLayerMouseEvent["features"]>[number],
): PowerFinderFeature | null {
  const raw = rendered.properties ?? {};
  const kind = optionalString(raw.kind) as PowerFinderKind | undefined;
  const id = rendered.id ?? raw.id;
  if (!kind || !selectableKinds.has(kind) || id == null) return null;
  const maxVoltage = optionalNumber(raw.max_voltage_kv);
  const rawVoltage = raw.voltage_kv;
  const voltageValues = Array.isArray(rawVoltage)
    ? rawVoltage.map(optionalNumber).filter((value): value is number => value != null)
    : typeof rawVoltage === "string"
      ? rawVoltage
          .replaceAll("[", "")
          .replaceAll("]", "")
          .replaceAll('"', "")
          .split(/[,/]/)
          .map(optionalNumber)
          .filter((value): value is number => value != null)
      : maxVoltage != null
        ? [maxVoltage]
        : undefined;
  const evidence = optionalString(raw.evidence_class);
  const properties: PowerFinderProperties = {
    kind,
    name: optionalString(raw.name) ?? `${kind.replaceAll("_", " ")} ${String(id)}`,
    evidence_class:
      evidence === "official_operator" ||
      evidence === "official_regulatory" ||
      evidence === "official_public" ||
      evidence === "test_fixture"
        ? evidence
        : "open_mapping",
    operator: optionalString(raw.operator),
    voltage_kv: voltageValues,
    max_voltage_kv: maxVoltage,
    status: optionalString(raw.status),
    source_url: optionalString(raw.source_url),
    site_kind: optionalString(raw.site_kind),
    area_ha: optionalNumber(raw.area_ha),
    planning_status: optionalString(raw.planning_status),
    technology: optionalString(raw.technology),
    generation_group: optionalString(raw.generation_group) as
      | PowerFinderProperties["generation_group"]
      | undefined,
    net_capacity_mw: optionalNumber(raw.net_capacity_mw) ?? optionalNumber(raw.registered_mw),
    storage_energy_mwh: optionalNumber(raw.storage_energy_mwh),
  };
  return {
    type: "Feature",
    id: String(id),
    geometry: rendered.geometry,
    properties,
  };
}

function renderedFeatureCount(map: MapLibreMap, layer: string) {
  if (!map.getLayer(layer)) return 0;
  const identifiers = new Set(
    map
      .queryRenderedFeatures({ layers: [layer] })
      .map((feature) =>
        String(feature.id ?? feature.properties?.name ?? JSON.stringify(feature.geometry)),
      ),
  );
  return identifiers.size;
}

export function publishVisibleLayerCounts(
  map: MapLibreMap,
  callback: ((counts: VisibleLayerCounts) => void) | undefined,
) {
  callback?.({
    node:
      renderedFeatureCount(map, "national-grid-nodes") + renderedFeatureCount(map, "grid-nodes"),
    line:
      renderedFeatureCount(map, "national-grid-lines") + renderedFeatureCount(map, "grid-lines"),
    industrial_site:
      renderedFeatureCount(map, "national-industrial-sites") +
      renderedFeatureCount(map, "industrial-sites"),
    generation_asset:
      renderedFeatureCount(map, "national-generation-overview") +
      renderedFeatureCount(map, "national-generation-assets") +
      renderedFeatureCount(map, "generation-assets"),
    storage_asset:
      renderedFeatureCount(map, "national-storage-assets") +
      renderedFeatureCount(map, "storage-assets"),
  });
}

export function withCapacityResults(
  value: PowerFinderCollection,
  capacityNodes: CalculatedCapacityNode[],
  capacityMetric: CapacityMetric,
  requiredCapacityMw: number,
) {
  const byNode = new Map(capacityNodes.map((result) => [result.publicNodeId, result]));
  return {
    ...value,
    features: value.features.map((feature) => {
      const result = byNode.get(String(feature.id));
      const opportunity = classifyCapacityOpportunity(result, capacityMetric, requiredCapacityMw);
      return result
        ? ({
            ...feature,
            properties: {
              ...feature.properties,
              ...(opportunity.valueMw === null
                ? {}
                : { calculated_capacity_mw: opportunity.valueMw }),
              capacity_validation_state: result.validationState,
              capacity_fit: opportunity.fit,
              capacity_ratio: opportunity.coverageRatio ?? 0,
              capacity_meets: opportunity.fit === "meets" ? 1 : 0,
              capacity_activation: opportunity.fit === "activation" ? 1 : 0,
            },
          } as PowerFinderFeature)
        : feature;
    }),
  };
}
