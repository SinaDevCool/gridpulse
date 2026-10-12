import { addMapLayer } from "./registration";
import type { Map as MapLibreMap } from "maplibre-gl";
import { registeredMwLabel, storageAssetFilter } from "./layer-style";
import type { MapResources } from "./resource-contract";
export function registerNationalStorageLayers(
  map: MapLibreMap,
  resources: Pick<MapResources, "enabledLayersRef" | "assetFilterRef">,
  isCancelled: () => boolean,
) {
  const { enabledLayersRef, assetFilterRef } = resources;
  addMapLayer(map, {
    id: "national-storage-assets",
    type: "circle",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    minzoom: 4,
    maxzoom: 24,
    filter: storageAssetFilter(
      assetFilterRef.current.minimumStorageMw,
      assetFilterRef.current.maximumStorageMw,
    ),
    layout: {
      visibility: enabledLayersRef.current.storage_asset ? "visible" : "none",
    },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "asset_count"], 1],
        1,
        7,
        25,
        11,
        100,
        16,
      ],
      "circle-color": "#a855f7",
      "circle-stroke-color": "#f3e8ff",
      "circle-stroke-width": 1,
    },
  });
  addMapLayer(map, {
    id: "national-storage-technology-icon",
    type: "symbol",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    minzoom: 4,
    maxzoom: 24,
    filter: storageAssetFilter(
      assetFilterRef.current.minimumStorageMw,
      assetFilterRef.current.maximumStorageMw,
    ),
    layout: {
      visibility: enabledLayersRef.current.storage_asset ? "visible" : "none",
      "icon-image": "energy-storage",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "asset_count"], 1],
        1,
        0.82,
        25,
        1.12,
        100,
        1.45,
      ],
      "icon-allow-overlap": false,
      "icon-padding": 4,
      "symbol-sort-key": [
        "-",
        0,
        ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], 0],
      ],
    },
  });
  addMapLayer(map, {
    id: "national-storage-asset-labels",
    type: "symbol",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    minzoom: 11,
    maxzoom: 24,
    filter: storageAssetFilter(
      assetFilterRef.current.minimumStorageMw,
      assetFilterRef.current.maximumStorageMw,
    ),
    layout: {
      visibility: enabledLayersRef.current.storage_asset ? "visible" : "none",
      "text-field": registeredMwLabel,
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#2e1065",
      "text-halo-color": "rgba(255,255,255,0.92)",
      "text-halo-width": 1.5,
    },
  });
}
