import { addMapLayer } from "./registration";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  generationClusterColour,
  localGenerationColour,
  registeredCapacityRadius,
  registeredClusterRadius,
  sourceIds,
} from "./layer-style";
import type { MapResources } from "./resource-contract";
export function registerLocalAssetLayers(
  map: MapLibreMap,
  resources: Pick<MapResources, never>,
  isCancelled: () => boolean,
) {
  addMapLayer(map, {
    id: "generation-clusters",
    type: "circle",
    source: sourceIds.generation_asset,
    layout: { visibility: "none" },
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": registeredClusterRadius,
      "circle-color": generationClusterColour,
      "circle-stroke-color": "#dcfce7",
      "circle-stroke-width": 2,
    },
  });
  addMapLayer(map, {
    id: "generation-cluster-count",
    type: "symbol",
    source: sourceIds.generation_asset,
    layout: {
      visibility: "none",
      "text-field": [
        "case",
        [">", ["get", "known_mw_count"], 0],
        [
          "case",
          ["<", ["get", "registered_mw"], 1],
          "<1 MW",
          ["concat", ["round", ["get", "registered_mw"]], " MW"],
        ],
        ["concat", ["get", "point_count_abbreviated"], " assets"],
      ],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
    },
    filter: ["has", "point_count"],
    paint: {
      "text-color": "#07111f",
      "text-halo-color": "rgba(255,255,255,0.85)",
      "text-halo-width": 1,
    },
  });
  addMapLayer(map, {
    id: "generation-assets",
    type: "circle",
    source: sourceIds.generation_asset,
    layout: { visibility: "none" },
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": registeredCapacityRadius,
      "circle-color": localGenerationColour,
      "circle-stroke-color": "#dcfce7",
      "circle-stroke-width": 1,
    },
  });
  addMapLayer(map, {
    id: "storage-clusters",
    type: "circle",
    source: sourceIds.storage_asset,
    layout: { visibility: "none" },
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": registeredClusterRadius,
      "circle-color": "#a855f7",
      "circle-stroke-color": "#f3e8ff",
      "circle-stroke-width": 2,
    },
  });
  addMapLayer(map, {
    id: "storage-cluster-count",
    type: "symbol",
    source: sourceIds.storage_asset,
    layout: {
      visibility: "none",
      "text-field": [
        "case",
        [">", ["get", "known_mw_count"], 0],
        [
          "case",
          ["<", ["get", "registered_mw"], 1],
          "<1 MW",
          ["concat", ["round", ["get", "registered_mw"]], " MW"],
        ],
        ["concat", ["get", "point_count_abbreviated"], " assets"],
      ],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
    },
    filter: ["has", "point_count"],
    paint: { "text-color": "#2e1065" },
  });
  addMapLayer(map, {
    id: "storage-assets",
    type: "circle",
    source: sourceIds.storage_asset,
    layout: { visibility: "none" },
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": registeredCapacityRadius,
      "circle-color": "#a855f7",
      "circle-stroke-color": "#f3e8ff",
      "circle-stroke-width": 1,
    },
  });
}
