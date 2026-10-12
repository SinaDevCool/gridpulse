import { addMapLayer, addMapSource } from "./registration";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapResources } from "./resource-contract";
export function registerDiscoveryLayers(
  map: MapLibreMap,
  resources: Pick<
    MapResources,
    "onDiscoverySelectRef" | "selectedFeatureRef" | "previewFeatureRef"
  >,
  isCancelled: () => boolean,
) {
  const { onDiscoverySelectRef, selectedFeatureRef, previewFeatureRef } = resources;
  addMapLayer(map, {
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
  addMapLayer(map, {
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
  addMapLayer(map, {
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
  addMapSource(map, "finder-selected-candidate", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: highlighted?.geometry.type === "Point" ? [highlighted] : [],
    },
  });
  addMapLayer(map, {
    id: "berlin-capacity-coverage-fill",
    type: "fill",
    source: "berlin-capacity-coverage",
    layout: { visibility: "none" },
    paint: { "fill-color": "#38bdf8", "fill-opacity": 0.055 },
  });
  addMapLayer(map, {
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
  addMapLayer(map, {
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
