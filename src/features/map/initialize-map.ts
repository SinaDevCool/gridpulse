import { activateDataOnlyBasemap,loadBasemapStyle } from "@/features/power-finder/basemap-config";
import { preloadEnergyIconImages } from "./icon-loader";
import { registerDataCentreLayers } from "./registerDataCentreLayers";
import { registerDiscoveryLayers } from "./registerDiscoveryLayers";
import { registerInteractions } from "./registerInteractions";
import { registerLocalAssetLayers } from "./registerLocalAssetLayers";
import { registerLocalGridLayers } from "./registerLocalGridLayers";
import { registerNationalGenerationLayers } from "./registerNationalGenerationLayers";
import { registerNationalGridLayers } from "./registerNationalGridLayers";
import { registerNationalStorageLayers } from "./registerNationalStorageLayers";
import { registerSelectionLayers } from "./registerSelectionLayers";
import { registerSources } from "./registerSources";
import type { useMapResources } from "./use-map-resources";
export function initializeMap(resources: ReturnType<typeof useMapResources>) {
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
  if (!containerRef.current || mapRef.current) return;
  let cancelled = false;
  globalThis.performance?.mark("gridpulse-map-initialise");
  onBasemapStatusChangeRef.current?.("loading");
  const startupDeadline = globalThis.setTimeout(
    () => onBasemapStatusChangeRef.current?.("fallback"),
    3_500,
  );
  void Promise.all([
    import("maplibre-gl"),
    loadBasemapStyle(basemapModeRef.current),
    preloadEnergyIconImages().catch((reason: unknown) => {
      console.warn(
        "Energy map pictograms could not be loaded; coloured markers remain available.",
        reason,
      );
      return [];
    }),
  ]).then(([{ Map, NavigationControl, AttributionControl }, basemap, energyIcons]) => {
    globalThis.clearTimeout(startupDeadline);
    if (cancelled || !containerRef.current) return;
    basemapLayerIdsRef.current = basemap.layerIds;
    onBasemapStatusChangeRef.current?.(basemap.status);
    const map = new Map({
      container: containerRef.current,
      center: projectSiteRef.current ?? [13.36, 52.31],
      zoom: projectSiteRef.current ? 11.2 : 9.1,
      attributionControl: false,
      style: basemap.style,
    });
    const decorativeBasemapImages = new Set(["wood-pattern", "circle-11"]);
    map.setMissingStyleImageResolver((id) => {
      if (!decorativeBasemapImages.has(id) || map.hasImage(id)) return;
      map.addImage(id, {
        width: 1,
        height: 1,
        data: new Uint8Array([0, 0, 0, 0]),
      });
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    let basemapErrorCount = 0;
    map.on("error", (event) => {
      const sourceId = "sourceId" in event ? String(event.sourceId ?? "") : "";
      const message = event.error?.message ?? "";
      const openFreeMapFailure =
        sourceId === "openmaptiles" ||
        sourceId === "ne2_shaded" ||
        message.includes("tiles.openfreemap.org");
      if (
        sourceId === "power-finder-national-tiles" ||
        sourceId === "power-finder-registry-tiles"
      ) {
        const key = sourceId === "power-finder-national-tiles" ? "grid" : "registry";
        runtimeSourceStatusRef.current = { ...runtimeSourceStatusRef.current, [key]: "error" };
        onDataSourceStatusChangeRef.current?.(runtimeSourceStatusRef.current);
      }
      if (!openFreeMapFailure) return;
      basemapErrorCount += 1;
      if (basemapErrorCount >= 3 && !basemapFallbackActiveRef.current) {
        basemapFallbackActiveRef.current = true;
        activateDataOnlyBasemap(map, basemapModeRef.current, basemapLayerIdsRef.current);
        onBasemapStatusChangeRef.current?.("fallback");
      }
    });
    map.on("load", () => {
      for (const [id, image] of energyIcons) {
        if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
      }
      globalThis.performance?.mark("gridpulse-map-ready");
      globalThis.performance?.measure(
        "gridpulse-map-startup",
        "gridpulse-map-initialise",
        "gridpulse-map-ready",
      );
      registerSources(map, resources, () => cancelled);
      registerDataCentreLayers(map, resources, () => cancelled);
      registerDiscoveryLayers(map, resources, () => cancelled);
      registerNationalGridLayers(map, resources, () => cancelled);
      registerNationalGenerationLayers(map, resources, () => cancelled);
      registerNationalStorageLayers(map, resources, () => cancelled);
      registerLocalGridLayers(map, resources, () => cancelled);
      registerLocalAssetLayers(map, resources, () => cancelled);
      registerSelectionLayers(map, resources, () => cancelled);
      registerInteractions(map, resources, () => cancelled);
    });
  });
  return () => {
    cancelled = true;
    globalThis.clearTimeout(startupDeadline);
    mapRef.current?.remove();
    mapRef.current = null;
  };
}
