import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

export const sourceIds = {
  node: "power-finder-nodes",
  line: "power-finder-lines",
  industrial_site: "power-finder-industrial-sites",
  generation_asset: "power-finder-generation-assets",
  storage_asset: "power-finder-storage-assets",
} as const;

export function generationAssetFilter(
  group: string,
  minimumMw: number,
  maximumMw: number | null = null,
): ExpressionSpecification {
  const conditions: ExpressionSpecification[] = [["==", ["get", "kind"], "generation_asset"]];
  if (group !== "all") conditions.push(["==", ["get", "generation_group"], group]);
  if (minimumMw > 0)
    conditions.push([
      ">=",
      ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], -1],
      minimumMw,
    ]);
  if (maximumMw !== null)
    conditions.push([
      "<=",
      ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], maximumMw + 1],
      maximumMw,
    ]);
  return ["all", ...conditions] as ExpressionSpecification;
}

export function storageAssetFilter(
  minimumMw: number,
  maximumMw: number | null = null,
): ExpressionSpecification {
  const conditions: ExpressionSpecification[] = [["==", ["get", "kind"], "storage_asset"]];
  if (minimumMw > 0)
    conditions.push([
      ">=",
      ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], -1],
      minimumMw,
    ]);
  if (maximumMw !== null)
    conditions.push([
      "<=",
      ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], maximumMw + 1],
      maximumMw,
    ]);
  return ["all", ...conditions] as ExpressionSpecification;
}

export function applyOverlayTheme(map: MapLibreMap, mode: "dark" | "light") {
  const light = mode === "light";
  const set = (layer: string, property: string, value: unknown) => {
    if (map.getLayer(layer))
      map.setPaintProperty(
        layer,
        property as Parameters<MapLibreMap["setPaintProperty"]>[1],
        value as never,
      );
  };
  const outline = light ? "#17324a" : "#ffffff";
  const paleOutline = light ? "#27485f" : "#dcfce7";
  set("national-industrial-overview", "circle-color", light ? "#ffffff" : "rgba(7, 17, 31, 0.75)");
  set("national-industrial-overview", "circle-stroke-color", light ? "#087f78" : "#99f6e4");
  set("national-industrial-overview", "circle-stroke-width", light ? 2 : 1.5);
  set("national-industrial-sites", "fill-color", light ? "#0f9f94" : "#17c3b2");
  set("national-industrial-sites", "fill-outline-color", light ? "#075f5a" : "#5eead4");
  set("national-generation-overview", "circle-stroke-color", outline);
  set("national-generation-assets", "circle-stroke-color", outline);
  set("national-storage-assets", "circle-stroke-color", light ? "#4c1d95" : "#f3e8ff");
  set("grid-nodes", "circle-stroke-color", paleOutline);
  set("node-clusters", "circle-stroke-color", light ? "#78350f" : "#fff7d6");
  set("generation-clusters", "circle-stroke-color", paleOutline);
  set("generation-assets", "circle-stroke-color", paleOutline);
  set("storage-clusters", "circle-stroke-color", light ? "#4c1d95" : "#f3e8ff");
  set("storage-assets", "circle-stroke-color", light ? "#4c1d95" : "#f3e8ff");
}

export const registeredCapacityRadius: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["sqrt", ["max", 0.01, ["coalesce", ["get", "net_capacity_mw"], 0.01]]],
  0.1,
  3,
  1,
  5,
  3.2,
  8,
  10,
  13,
  31.7,
  19,
];

export const generationClusterColour: ExpressionSpecification = [
  "case",
  [">=", ["get", "solar_count"], ["max", ["get", "wind_count"], ["get", "other_count"]]],
  "#facc15",
  [">=", ["get", "wind_count"], ["get", "other_count"]],
  "#38bdf8",
  "#94a3b8",
];

export const registeredClusterRadius: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["sqrt", ["max", 1, ["get", "registered_mw"]]],
  1,
  14,
  10,
  20,
  32,
  28,
  100,
  38,
];

export const registeredMwLabel: ExpressionSpecification = [
  "case",
  [">=", ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], -1], 1],
  [
    "concat",
    ["to-string", ["round", ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"]]]],
    " MW",
  ],
  [">", ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], -1], 0],
  "<1 MW",
  "MW unknown",
];

const registeredAggregateMagnitude: ExpressionSpecification = [
  "sqrt",
  [
    "max",
    1,
    ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], ["get", "asset_count"], 1],
  ],
];

export const registeredAggregateRadius: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  registeredAggregateMagnitude,
  1,
  11,
  4,
  13,
  10,
  18,
  32,
  25,
  100,
  34,
];

export const registeredAggregateIconSize: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  registeredAggregateMagnitude,
  1,
  1,
  4,
  1.08,
  10,
  1.2,
  32,
  1.4,
  100,
  1.75,
];

export const registeredAggregateLabel: ExpressionSpecification = [
  "case",
  [">=", ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], -1], 1],
  [
    "concat",
    ["to-string", ["round", ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"]]]],
    " MW",
  ],
  [">", ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], -1], 0],
  "<1 MW",
  [">", ["coalesce", ["get", "asset_count"], 1], 1],
  ["concat", ["to-string", ["get", "asset_count"]], " assets"],
  "MW unknown",
];

export const localGenerationColour: ExpressionSpecification = [
  "match",
  ["coalesce", ["get", "generation_group"], ["get", "technology"]],
  "solar",
  "#facc15",
  "wind",
  "#38bdf8",
  "biomass",
  "#22c55e",
  "hydro",
  "#06b6d4",
  "geothermal",
  "#f97316",
  "nuclear",
  "#f472b6",
  "gas",
  "#a78bfa",
  "fossil_other",
  "#ef4444",
  "Solare Strahlungsenergie",
  "#facc15",
  "Solarthermie",
  "#facc15",
  "Wind",
  "#38bdf8",
  "Biomasse",
  "#22c55e",
  "Wasser",
  "#06b6d4",
  "Geothermie",
  "#f97316",
  "Erdgas",
  "#a78bfa",
  "andere Gase",
  "#a78bfa",
  "Grubengas",
  "#a78bfa",
  "Kernenergie",
  "#f472b6",
  "#94a3b8",
];
