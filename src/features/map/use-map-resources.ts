import type { MapRuntimeSourceStatus } from "@/features/map/map-source-registry";
import { type BasemapLayerIds } from "@/features/power-finder/basemap-config";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useMemo,useRef } from "react";
import { type PowerFinderMapProps } from "./contracts";
export function useMapResources({
  collection,
  enabledLayers,
  selectedFeature,
  previewFeature,
  mapMode,
  basemapMode = "dark",
  generationGroup = "all",
  minimumGenerationMw = 0,
  maximumGenerationMw = null,
  minimumStorageMw = 0,
  maximumStorageMw = null,
  isolatedVoltageClass = null,
  scaleMarkersByCapacity = true,
  capacityNodes = [],
  capacityMetric = "firm_import_mw",
  requiredCapacityMw = 1,
  capacityCoverage = null,
  viewportTarget,
  navigationTarget,
  onSelect,
  onViewportChange,
  projectSite,
  onSitePlacement,
  onVisibleLayerCounts,
  discoveryLocations = null,
  onDiscoverySelect,
  showDataCentres = true,
  onDataCentreSelect,
  onBasemapStatusChange,
  onDataSourceStatusChange,
}: PowerFinderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewportChangeRef = useRef(onViewportChange);
  const collectionRef = useRef(collection);
  const projectSiteRef = useRef(projectSite);
  const onSitePlacementRef = useRef(onSitePlacement);
  const onVisibleLayerCountsRef = useRef(onVisibleLayerCounts);
  const onDiscoverySelectRef = useRef(onDiscoverySelect);
  const discoveryLocationsRef = useRef(discoveryLocations);
  const onDataCentreSelectRef = useRef(onDataCentreSelect);
  const showDataCentresRef = useRef(showDataCentres);
  const selectedFeatureRef = useRef(selectedFeature);
  const previewFeatureRef = useRef(previewFeature);
  const capacityNodesRef = useRef(capacityNodes);
  const capacityMetricRef = useRef(capacityMetric);
  const requiredCapacityMwRef = useRef(requiredCapacityMw);
  const capacityCoverageRef = useRef(capacityCoverage);
  const basemapModeRef = useRef(basemapMode);
  const basemapLayerIdsRef = useRef<BasemapLayerIds>({ dark: [], light: [] });
  const basemapFallbackActiveRef = useRef(false);
  const onBasemapStatusChangeRef = useRef(onBasemapStatusChange);
  const onDataSourceStatusChangeRef = useRef(onDataSourceStatusChange);
  const runtimeSourceStatusRef = useRef<MapRuntimeSourceStatus>({
    grid: "loading",
    registry: "loading",
  });
  const enabledLayersRef = useRef(enabledLayers);
  const assetFilterRef = useRef({
    generationGroup,
    minimumGenerationMw,
    maximumGenerationMw,
    minimumStorageMw,
    maximumStorageMw,
  });
  const isolatedVoltageClassRef = useRef(isolatedVoltageClass);
  const scaleMarkersByCapacityRef = useRef(scaleMarkersByCapacity);
  onSelectRef.current = onSelect;
  onViewportChangeRef.current = onViewportChange;
  collectionRef.current = collection;
  projectSiteRef.current = projectSite;
  onSitePlacementRef.current = onSitePlacement;
  onVisibleLayerCountsRef.current = onVisibleLayerCounts;
  onDiscoverySelectRef.current = onDiscoverySelect;
  discoveryLocationsRef.current = discoveryLocations;
  onDataCentreSelectRef.current = onDataCentreSelect;
  showDataCentresRef.current = showDataCentres;
  selectedFeatureRef.current = selectedFeature;
  previewFeatureRef.current = previewFeature;
  capacityNodesRef.current = capacityNodes;
  capacityMetricRef.current = capacityMetric;
  requiredCapacityMwRef.current = requiredCapacityMw;
  capacityCoverageRef.current = capacityCoverage;
  basemapModeRef.current = basemapMode;
  onBasemapStatusChangeRef.current = onBasemapStatusChange;
  onDataSourceStatusChangeRef.current = onDataSourceStatusChange;
  enabledLayersRef.current = enabledLayers;
  assetFilterRef.current = {
    generationGroup,
    minimumGenerationMw,
    maximumGenerationMw,
    minimumStorageMw,
    maximumStorageMw,
  };
  isolatedVoltageClassRef.current = isolatedVoltageClass;
  scaleMarkersByCapacityRef.current = scaleMarkersByCapacity;
  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}
