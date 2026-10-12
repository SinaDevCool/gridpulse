import type { Map as MapLibreMap } from "maplibre-gl";
import type { useMapResources } from "./use-map-resources";
export function registerDiscoveryLayers(
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
    id: "finder-discovery-halos",
    type: "circle",
    source: "finder-discovery-locations",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 20, 100, 30],
      "circle-color": "#07131c",
      "circle-opacity": 0.92,
      "circle-stroke-color": "#f8d34f",
      "circle-stroke-width": 4,
    },
  });
  map.addLayer({
    id: "finder-discovery-locations",
    type: "circle",
    source: "finder-discovery-locations",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 14, 100, 22],
      "circle-color": "#12c8e8",
      "circle-opacity": 1,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: "finder-discovery-labels",
    type: "symbol",
    source: "finder-discovery-locations",
    layout: {
      "text-field": ["to-string", ["get", "rank"]],
      "text-size": 12,
      "text-font": ["Noto Sans Bold"],
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#04131d" },
  });
  map.on("click", "finder-discovery-locations", (event) => {
    const id = event.features?.[0]?.properties?.id;
    if (id) onDiscoverySelectRef.current?.(String(id));
  });
  const highlighted = previewFeatureRef.current ?? selectedFeatureRef.current;
  map.addSource("finder-selected-candidate", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: highlighted?.geometry.type === "Point" ? [highlighted] : [],
    },
  });
  map.addLayer({
    id: "berlin-capacity-coverage-fill",
    type: "fill",
    source: "berlin-capacity-coverage",
    layout: { visibility: "none" },
    paint: { "fill-color": "#38bdf8", "fill-opacity": 0.055 },
  });
  map.addLayer({
    id: "berlin-capacity-coverage-line",
    type: "line",
    source: "berlin-capacity-coverage",
    layout: { visibility: "none" },
    paint: {
      "line-color": "#38bdf8",
      "line-width": 2,
      "line-dasharray": [3, 2],
      "line-opacity": 0.9,
    },
  });
  map.addLayer({
    id: "finder-project-site",
    type: "circle",
    source: "finder-project-site",
    paint: {
      "circle-radius": 10,
      "circle-color": "#38d7f2",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
}
