import type { Map as MapLibreMap } from "maplibre-gl";
import type { RefObject } from "react";
import type { BasemapLayerIds } from "../power-finder/basemap-config";
import type { PowerFinderMapProps } from "./contracts";
import type { MapRuntimeSourceStatus } from "./map-source-registry";

type PropRef<K extends keyof PowerFinderMapProps> = RefObject<PowerFinderMapProps[K]>;
type DefaultedRef<K extends keyof PowerFinderMapProps> = RefObject<
  NonNullable<PowerFinderMapProps[K]>
>;
/** Runtime registrations depend on this contract, never on a React hook implementation. */
export interface MapResources {
  containerRef: RefObject<HTMLDivElement | null>;
  mapRef: RefObject<MapLibreMap | null>;
  onSelectRef: PropRef<"onSelect">;
  onViewportChangeRef: PropRef<"onViewportChange">;
  collectionRef: PropRef<"collection">;
  projectSiteRef: PropRef<"projectSite">;
  onSitePlacementRef: PropRef<"onSitePlacement">;
  onVisibleLayerCountsRef: PropRef<"onVisibleLayerCounts">;
  onDiscoverySelectRef: PropRef<"onDiscoverySelect">;
  discoveryLocationsRef: RefObject<PowerFinderMapProps["discoveryLocations"] | null>;
  onDataCentreSelectRef: PropRef<"onDataCentreSelect">;
  showDataCentresRef: DefaultedRef<"showDataCentres">;
  selectedFeatureRef: PropRef<"selectedFeature">;
  previewFeatureRef: PropRef<"previewFeature">;
  capacityNodesRef: DefaultedRef<"capacityNodes">;
  capacityMetricRef: DefaultedRef<"capacityMetric">;
  requiredCapacityMwRef: DefaultedRef<"requiredCapacityMw">;
  capacityCoverageRef: RefObject<PowerFinderMapProps["capacityCoverage"] | null>;
  basemapModeRef: DefaultedRef<"basemapMode">;
  basemapLayerIdsRef: RefObject<BasemapLayerIds>;
  basemapFallbackActiveRef: RefObject<boolean>;
  onBasemapStatusChangeRef: PropRef<"onBasemapStatusChange">;
  onDataSourceStatusChangeRef: PropRef<"onDataSourceStatusChange">;
  runtimeSourceStatusRef: RefObject<MapRuntimeSourceStatus>;
  enabledLayersRef: PropRef<"enabledLayers">;
  assetFilterRef: RefObject<{
    generationGroup: string;
    minimumGenerationMw: number;
    maximumGenerationMw: number | null;
    minimumStorageMw: number;
    maximumStorageMw: number | null;
  }>;
  isolatedVoltageClassRef: RefObject<NonNullable<
    PowerFinderMapProps["isolatedVoltageClass"]
  > | null>;
  scaleMarkersByCapacityRef: RefObject<boolean>;
}
