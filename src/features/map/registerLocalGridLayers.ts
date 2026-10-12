import {
voltageClassFilter,
voltageColorExpression,
voltageWidthExpression,
} from "@/features/power-finder/voltage-style";
import type { ExpressionSpecification,Map as MapLibreMap } from "maplibre-gl";
import { sourceIds } from "./layer-style";
import type { useMapResources } from "./use-map-resources";
export function registerLocalGridLayers(
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
    id: "industrial-sites",
    type: "fill",
    source: sourceIds.industrial_site,
    layout: { visibility: "none" },
    paint: {
      "fill-color": "#17c3b2",
      "fill-opacity": 0.2,
      "fill-outline-color": "#5eead4",
    },
  });
  map.addLayer({
    id: "grid-lines",
    type: "line",
    source: sourceIds.line,
    minzoom: 8,
    layout: { visibility: "none" },
    filter: voltageClassFilter(isolatedVoltageClassRef.current) ?? ["has", "kind"],
    paint: {
      "line-color": voltageColorExpression(),
      "line-width": voltageWidthExpression(),
      "line-opacity": 0.85,
    },
  });
  map.addLayer({
    id: "node-clusters",
    type: "circle",
    source: sourceIds.node,
    minzoom: 8,
    layout: { visibility: "none" },
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 15, 25, 19, 100, 24],
      "circle-color": ["step", ["get", "point_count"], "#f59e0b", 25, "#f97316", 100, "#ef4444"],
      "circle-stroke-color": "#fff7d6",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "node-cluster-count",
    type: "symbol",
    source: sourceIds.node,
    minzoom: 8,
    filter: ["has", "point_count"],
    layout: {
      visibility: "none",
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
    },
    paint: { "text-color": "#07111f" },
  });
  map.addLayer({
    id: "grid-nodes",
    type: "circle",
    source: sourceIds.node,
    minzoom: 8,
    layout: { visibility: "none" },
    filter: (() => {
      const voltage = voltageClassFilter(isolatedVoltageClassRef.current);
      return voltage
        ? (["all", ["!", ["has", "point_count"]], voltage] as ExpressionSpecification)
        : ["!", ["has", "point_count"]];
    })(),
    paint: {
      "circle-radius": 7,
      "circle-color": "#f59e0b",
      "circle-stroke-color": "#fff7d6",
      "circle-stroke-width": 2,
    },
  });
}
