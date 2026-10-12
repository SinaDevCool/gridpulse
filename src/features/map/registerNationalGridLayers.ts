import { addMapLayer } from "./registration";
import {
  voltageClassFilter,
  voltageColorExpression,
  voltageWidthExpression,
} from "@/features/power-finder/voltage-style";
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { MapResources } from "./resource-contract";
export function registerNationalGridLayers(
  map: MapLibreMap,
  resources: Pick<MapResources, "enabledLayersRef" | "isolatedVoltageClassRef">,
  isCancelled: () => boolean,
) {
  const { enabledLayersRef, isolatedVoltageClassRef } = resources;
  addMapLayer(map, {
    id: "national-grid-lines",
    type: "line",
    source: "power-finder-national-tiles",
    "source-layer": "power_finder",
    minzoom: 4,
    maxzoom: 24,
    filter: (() => {
      const voltage = voltageClassFilter(isolatedVoltageClassRef.current);
      return voltage
        ? (["all", ["==", ["get", "kind"], "line"], voltage] as ExpressionSpecification)
        : ["==", ["get", "kind"], "line"];
    })(),
    layout: { visibility: enabledLayersRef.current.line ? "visible" : "none" },
    paint: {
      "line-color": voltageColorExpression(),
      "line-width": voltageWidthExpression(),
      "line-opacity": 0.82,
    },
  });
  addMapLayer(map, {
    id: "national-grid-nodes",
    type: "circle",
    source: "power-finder-national-tiles",
    "source-layer": "power_finder",
    minzoom: 4,
    maxzoom: 24,
    filter: (() => {
      const voltage = voltageClassFilter(isolatedVoltageClassRef.current);
      return voltage
        ? (["all", ["==", ["get", "kind"], "node"], voltage] as ExpressionSpecification)
        : ["==", ["get", "kind"], "node"];
    })(),
    layout: { visibility: enabledLayersRef.current.node ? "visible" : "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1, 7, 1.6, 8.5, 2.5, 11, 4.5],
      "circle-color": "#f59e0b",
      "circle-stroke-color": voltageColorExpression(),
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 9, 1],
    },
  });
  addMapLayer(map, {
    id: "national-industrial-sites",
    type: "fill",
    source: "power-finder-national-tiles",
    "source-layer": "power_finder",
    minzoom: 8,
    maxzoom: 24,
    filter: ["==", ["get", "kind"], "industrial_site"],
    layout: {
      visibility: enabledLayersRef.current.industrial_site ? "visible" : "none",
    },
    paint: {
      "fill-color": "#17c3b2",
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.28, 16, 0.48],
      "fill-outline-color": "#5eead4",
    },
  });
  addMapLayer(map, {
    id: "national-industrial-overview",
    type: "circle",
    source: "power-finder-national-tiles",
    "source-layer": "power_finder",
    minzoom: 8,
    maxzoom: 10,
    filter: ["==", ["get", "kind"], "industrial_site"],
    layout: {
      visibility: enabledLayersRef.current.industrial_site ? "visible" : "none",
    },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.2, 10, 5],
      "circle-color": "rgba(7, 17, 31, 0.75)",
      "circle-stroke-color": "#99f6e4",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.95,
    },
  });
}
