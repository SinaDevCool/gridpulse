import type { Map as MapLibreMap } from "maplibre-gl";
import type { useMapResources } from "./use-map-resources";
export function registerSelectionLayers(
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
    id: "selected-candidate-halo",
    type: "circle",
    source: "finder-selected-candidate",
    paint: {
      "circle-radius": 18,
      "circle-color": "rgba(56, 215, 242, 0.18)",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 4,
      "circle-blur": 0.15,
    },
  });
  map.addLayer({
    id: "selected-candidate-core",
    type: "circle",
    source: "finder-selected-candidate",
    paint: {
      "circle-radius": 7,
      "circle-color": "#38d7f2",
      "circle-stroke-color": "#07111f",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "selected-candidate-label",
    type: "symbol",
    source: "finder-selected-candidate",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 1.8],
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#07111f",
      "text-halo-width": 2,
    },
  });
}
