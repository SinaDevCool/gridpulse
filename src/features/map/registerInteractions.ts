import type { MapLayerMouseEvent,Map as MapLibreMap } from "maplibre-gl";
import {
isGeoJsonSource,
publishVisibleLayerCounts,
renderedFeatureToPowerFinderFeature,
} from "./feature-selection";
import { applyOverlayTheme,sourceIds } from "./layer-style";
import type { useMapResources } from "./use-map-resources";
export function registerInteractions(
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
  for (const layer of [
    "rzreg-data-centre-clusters",
    "rzreg-data-centre-cluster-count",
    "rzreg-data-centres-approximate-area",
    "rzreg-data-centres-approximate",
    "rzreg-data-centres-exact",
  ]) {
    map.moveLayer(layer);
  }
  applyOverlayTheme(map, basemapModeRef.current);
  const selectFeature = (event: MapLayerMouseEvent) => {
    const rendered = event.features?.[0];
    if (!rendered) return;
    const id = rendered?.id ?? rendered?.properties?.id;
    const feature =
      collectionRef.current.features.find((item) => String(item.id) === String(id)) ??
      renderedFeatureToPowerFinderFeature(rendered);
    if (feature) onSelectRef.current(feature);
  };
  for (const layer of [
    "grid-nodes",
    "industrial-sites",
    "grid-lines",
    "generation-assets",
    "storage-assets",
    "national-grid-nodes",
    "national-industrial-sites",
    "national-industrial-overview",
    "national-generation-overview",
    "national-generation-assets",
    "national-storage-assets",
  ]) {
    map.on("click", layer, selectFeature);
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
  const registerClusterExpansion = (layer: string, sourceId: string) => {
    map.on("click", layer, (event) => {
      const cluster = event.features?.[0];
      const clusterId = cluster?.properties?.cluster_id;
      if (!cluster || typeof clusterId !== "number" || cluster.geometry.type !== "Point") return;
      const coordinates = cluster.geometry.coordinates as [number, number];
      const source = map.getSource(sourceId);
      if (!isGeoJsonSource(source)) return;
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: coordinates, zoom, duration: 450 });
      });
    });
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  };
  registerClusterExpansion("node-clusters", sourceIds.node);
  registerClusterExpansion("generation-clusters", sourceIds.generation_asset);
  registerClusterExpansion("storage-clusters", sourceIds.storage_asset);
  registerClusterExpansion("rzreg-data-centre-clusters", "rzreg-data-centres");
  map.on("click", (event) => {
    if (!onSitePlacementRef.current) return;
    const interactive = map.queryRenderedFeatures(event.point, {
      layers: [
        "grid-nodes",
        "industrial-sites",
        "grid-lines",
        "generation-assets",
        "storage-assets",
        "node-clusters",
        "generation-clusters",
        "storage-clusters",
        "national-grid-nodes",
        "national-industrial-sites",
        "national-industrial-overview",
        "national-generation-overview",
        "national-generation-assets",
        "national-storage-assets",
        "rzreg-data-centre-clusters",
        "rzreg-data-centres-approximate-area",
        "rzreg-data-centres-exact",
        "rzreg-data-centres-approximate",
      ],
    });
    if (!interactive.length) {
      onSitePlacementRef.current([event.lngLat.lng, event.lngLat.lat]);
    }
  });
  map.moveLayer("finder-project-site");
  map.moveLayer("selected-candidate-halo");
  map.moveLayer("selected-candidate-core");
  map.moveLayer("selected-candidate-label");
  map.on("moveend", () => {
    const bounds = map.getBounds();
    onViewportChangeRef.current?.({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
    publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current);
  });
  map.on("idle", () => publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current));
}
