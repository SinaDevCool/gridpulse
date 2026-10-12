import type { Map as MapLibreMap } from "maplibre-gl";
import {
generationClusterColour,
localGenerationColour,
registeredCapacityRadius,
registeredClusterRadius,
sourceIds,
} from "./layer-style";
import type { useMapResources } from "./use-map-resources";
export function registerLocalAssetLayers(
  map: MapLibreMap,
  resources: ReturnType<typeof useMapResources>,
  isCancelled: () => boolean,
) {
  const {
    containerRef,
    mapRef,
    onSelectRef,
    onViewportChangeRef,
    collectionRef,
    projectSiteRef,
    onSitePlacementRef,
    onVisibleLayerCountsRef,
    onDiscoverySelectRef,
    discoveryLocationsRef,
    onDataCentreSelectRef,
    showDataCentresRef,
    selectedFeatureRef,
    previewFeatureRef,
    capacityNodesRef,
    capacityMetricRef,
    requiredCapacityMwRef,
    capacityCoverageRef,
    basemapModeRef,
    basemapLayerIdsRef,
    basemapFallbackActiveRef,
    onBasemapStatusChangeRef,
    onDataSourceStatusChangeRef,
    runtimeSourceStatusRef,
    enabledLayersRef,
    assetFilterRef,
    isolatedVoltageClassRef,
    scaleMarkersByCapacityRef,
  } = resources;
  map.addLayer({
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
  map.addLayer({
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
  map.addLayer({
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
  map.addLayer({
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
  map.addLayer({
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
  map.addLayer({
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
