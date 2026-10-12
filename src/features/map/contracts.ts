import type { FeatureCollection,Point,Polygon } from "geojson";

import type {
PowerFinderCollection,
PowerFinderFeature,
} from "@/features/power-finder/fixture-data";

import type { PowerFinderBounds } from "@/features/power-finder/data-source";

import { type VisibleLayerCounts } from "@/components/product/power-finder-map-data";

import type { CalculatedCapacityNode } from "@/features/power-finder/calculated-capacity";

import { type GridVoltageClassId } from "@/features/power-finder/voltage-style";

import type { MapRuntimeSourceStatus } from "@/features/map/map-source-registry";

import type { CapacityMetric } from "@/features/power-finder/calculated-capacity";

import { type BasemapStatus } from "@/features/power-finder/basemap-config";

export type EnergyIconImage = readonly [id: string, image: HTMLImageElement];

export type PowerFinderMapProps = {
  collection: PowerFinderCollection;
  enabledLayers: Record<PowerFinderFeature["properties"]["kind"], boolean>;
  selectedFeature?: PowerFinderFeature | null;
  previewFeature?: PowerFinderFeature | null;
  mapMode: "voltage" | "evidence" | "capacity";
  basemapMode?: "dark" | "light";
  generationGroup?: string;
  minimumGenerationMw?: number;
  maximumGenerationMw?: number | null;
  minimumStorageMw?: number;
  maximumStorageMw?: number | null;
  isolatedVoltageClass?: GridVoltageClassId | null;
  scaleMarkersByCapacity?: boolean;
  capacityNodes?: CalculatedCapacityNode[];
  capacityMetric?: CapacityMetric;
  requiredCapacityMw?: number;
  capacityCoverage?: FeatureCollection<Polygon> | null;
  viewportTarget?: { center: [number, number]; zoom: number };
  navigationTarget?:
    | { requestId: number; kind: "point"; center: [number, number]; zoom?: number }
    | {
        requestId: number;
        kind: "bounds";
        bounds: [number, number, number, number];
        maxZoom?: number;
      };
  onSelect: (feature: PowerFinderFeature) => void;
  onViewportChange?: (bounds: PowerFinderBounds) => void;
  projectSite?: [number, number] | null;
  onSitePlacement?: (coordinates: [number, number]) => void;
  onVisibleLayerCounts?: (counts: VisibleLayerCounts) => void;
  discoveryLocations?: FeatureCollection<Point> | null;
  onDiscoverySelect?: (id: string) => void;
  showDataCentres?: boolean;
  onDataCentreSelect?: (dataCentre: RzRegDataCentre) => void;
  onBasemapStatusChange?: (status: BasemapStatus) => void;
  onDataSourceStatusChange?: (status: MapRuntimeSourceStatus) => void;
};

export type RzRegDataCentre = {
  id: string;
  rzregRow: number;
  name: string;
  operator: string;
  postcode: string;
  address: string | null;
  locationPrecision: "facility_address" | "postcode_area";
  coordinateMethod: string;
  truthLabel: string;
  sourceUrl: string | null;
  warning: string | null;
  coordinates: [number, number];
};
