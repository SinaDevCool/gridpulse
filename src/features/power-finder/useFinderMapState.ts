import type { VisibleLayerCounts } from "@/components/product/power-finder-map-data";
import type { RzRegDataCentre } from "@/components/product/PowerFinderMap";
import {
initialSharedMapFilterState,
sharedMapFilterReducer,
} from "@/features/map/map-filter-state";
import { mapIsolationFromSearch } from "@/features/map/map-url-state";
import type { BasemapStatus } from "@/features/power-finder/basemap-config";
import { type PowerFinderKind } from "@/features/power-finder/fixture-data";
import { useReducer,useState } from "react";
import { initialBounds } from './page-formatting';
import type { FinderSearch } from "./search-contract";

export function useFinderMapState(search: FinderSearch) {
  const [enabled, setEnabled] = useState<Record<PowerFinderKind, boolean>>(() => {
    if (search.mapView === "generation")
      return {
        node: false,
        line: true,
        industrial_site: false,
        generation_asset: true,
        storage_asset: true,
      };
    if (search.mapView === "infrastructure")
      return {
        node: true,
        line: true,
        industrial_site: false,
        generation_asset: false,
        storage_asset: false,
      };
    return {
      node: true,
      line: true,
      industrial_site: false,
      generation_asset: false,
      storage_asset: false,
    };
  });

  const [bounds, setBounds] = useState(initialBounds);

  const [visibleLayerCounts, setVisibleLayerCounts] = useState<VisibleLayerCounts>({
    node: 0,
    line: 0,
    industrial_site: 0,
    generation_asset: 0,
    storage_asset: 0,
  });

  const [showDataCentres, setShowDataCentres] = useState(false);

  const [selectedDataCentre, setSelectedDataCentre] = useState<RzRegDataCentre | null>(null);

  const [generationGroup, setGenerationGroup] = useState<string>(
    search.isolateTechnology && search.isolateTechnology !== "storage"
      ? search.isolateTechnology
      : "all",
  );

  const [mapFilters, dispatchMapFilter] = useReducer(sharedMapFilterReducer, {
    ...initialSharedMapFilterState,
    preset: search.mapView ?? "connection",
    isolation: mapIsolationFromSearch(search),
    minimumGenerationMw: search.generationMinMw ?? 0,
    maximumGenerationMw: search.generationMaxMw ?? null,
    minimumStorageMw: search.storageMinMw ?? 0,
    maximumStorageMw: search.storageMaxMw ?? null,
  });

  const [layersMenuOpen, setLayersMenuOpen] = useState(
    () => (search.mapView ?? "connection") !== "connection",
  );

  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>("loading");

  const [mapRetryKey, setMapRetryKey] = useState(0);

  const [mapNavigationTarget, setMapNavigationTarget] = useState<
    | { requestId: number; kind: "point"; center: [number, number]; zoom?: number }
    | {
        requestId: number;
        kind: "bounds";
        bounds: [number, number, number, number];
        maxZoom?: number;
      }
    | undefined
  >();
  return {
    enabled,
    setEnabled,
    bounds,
    setBounds,
    visibleLayerCounts,
    setVisibleLayerCounts,
    showDataCentres,
    setShowDataCentres,
    selectedDataCentre,
    setSelectedDataCentre,
    generationGroup,
    setGenerationGroup,
    mapFilters,
    dispatchMapFilter,
    layersMenuOpen,
    setLayersMenuOpen,
    basemapStatus,
    setBasemapStatus,
    mapRetryKey,
    setMapRetryKey,
    mapNavigationTarget,
    setMapNavigationTarget,
  };
}
