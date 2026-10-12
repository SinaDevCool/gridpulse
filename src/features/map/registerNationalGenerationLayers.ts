import { addMapLayer } from "./registration";
import {
  generationColourExpression,
  generationIconExpression,
} from "@/features/map/map-visual-registry";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  generationAssetFilter,
  registeredAggregateIconSize,
  registeredAggregateLabel,
  registeredAggregateRadius,
  registeredCapacityRadius,
  registeredMwLabel,
} from "./layer-style";
import type { MapResources } from "./resource-contract";
export function registerNationalGenerationLayers(
  map: MapLibreMap,
  resources: Pick<
    MapResources,
    "enabledLayersRef" | "assetFilterRef" | "scaleMarkersByCapacityRef"
  >,
  isCancelled: () => boolean,
) {
  const { enabledLayersRef, assetFilterRef, scaleMarkersByCapacityRef } = resources;
  addMapLayer(map, {
    id: "national-generation-overview",
    type: "circle",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    minzoom: 4,
    maxzoom: 14,
    filter: generationAssetFilter(
      assetFilterRef.current.generationGroup,
      assetFilterRef.current.minimumGenerationMw,
      assetFilterRef.current.maximumGenerationMw,
    ),
    layout: {
      visibility: enabledLayersRef.current.generation_asset ? "visible" : "none",
    },
    paint: {
      "circle-radius": registeredAggregateRadius,
      "circle-color": generationColourExpression,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 8.5, 0.34, 10.5, 0.82],
      "circle-stroke-color": "rgba(255, 255, 255, 0.7)",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.25, 9, 0.7],
    },
  });
  addMapLayer(map, {
    id: "national-generation-overview-label",
    type: "symbol",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    // Country and regional views should read as a technology map, not
    // a wall of capacity labels. Reveal values only after the user
    // has zoomed into an investigable area.
    minzoom: 7,
    maxzoom: 14,
    filter: [
      "all",
      generationAssetFilter(
        assetFilterRef.current.generationGroup,
        assetFilterRef.current.minimumGenerationMw,
        assetFilterRef.current.maximumGenerationMw,
      ),
      [">", ["coalesce", ["get", "asset_count"], 1], 1],
    ],
    layout: {
      visibility: enabledLayersRef.current.generation_asset ? "visible" : "none",
      "text-field": registeredAggregateLabel,
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-allow-overlap": true,
      "text-anchor": "top",
      "text-offset": [0, 1.45],
    },
    paint: {
      "text-color": "#07111f",
      "text-halo-color": "rgba(255,255,255,0.92)",
      "text-halo-width": 1.5,
    },
  });
  addMapLayer(map, {
    id: "national-generation-technology-glyph",
    type: "symbol",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    minzoom: 4,
    maxzoom: 24,
    filter: generationAssetFilter(
      assetFilterRef.current.generationGroup,
      assetFilterRef.current.minimumGenerationMw,
      assetFilterRef.current.maximumGenerationMw,
    ),
    layout: {
      visibility: enabledLayersRef.current.generation_asset ? "visible" : "none",
      "icon-image": generationIconExpression,
      "icon-size": registeredAggregateIconSize,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-padding": 3,
      "symbol-sort-key": [
        "-",
        0,
        ["coalesce", ["get", "registered_mw"], ["get", "net_capacity_mw"], 0],
      ],
    },
  });
  addMapLayer(map, {
    id: "national-generation-assets",
    type: "circle",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    minzoom: 14,
    maxzoom: 24,
    filter: generationAssetFilter(
      assetFilterRef.current.generationGroup,
      assetFilterRef.current.minimumGenerationMw,
      assetFilterRef.current.maximumGenerationMw,
    ),
    layout: {
      visibility: enabledLayersRef.current.generation_asset ? "visible" : "none",
    },
    paint: {
      "circle-radius": scaleMarkersByCapacityRef.current ? registeredCapacityRadius : 6,
      "circle-color": generationColourExpression,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.25,
    },
  });
  map.moveLayer("national-generation-technology-glyph");
  addMapLayer(map, {
    id: "national-generation-asset-labels",
    type: "symbol",
    source: "power-finder-registry-tiles",
    "source-layer": "power_finder",
    minzoom: 14,
    maxzoom: 24,
    filter: generationAssetFilter(
      assetFilterRef.current.generationGroup,
      assetFilterRef.current.minimumGenerationMw,
      assetFilterRef.current.maximumGenerationMw,
    ),
    layout: {
      visibility: enabledLayersRef.current.generation_asset ? "visible" : "none",
      "text-field": registeredMwLabel,
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#07111f",
      "text-halo-color": "rgba(255,255,255,0.92)",
      "text-halo-width": 1.5,
    },
  });
}
