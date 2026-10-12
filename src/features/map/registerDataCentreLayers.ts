import { addMapLayer } from "./registration";
import type { MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import type { MapResources } from "./resource-contract";
export function registerDataCentreLayers(
  map: MapLibreMap,
  resources: Pick<MapResources, "onDataCentreSelectRef" | "showDataCentresRef">,
  isCancelled: () => boolean,
) {
  const { onDataCentreSelectRef, showDataCentresRef } = resources;
  addMapLayer(map, {
    id: "rzreg-data-centre-clusters",
    type: "circle",
    source: "rzreg-data-centres",
    filter: ["has", "point_count"],
    layout: { visibility: showDataCentresRef.current ? "visible" : "none" },
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 30, 24],
      "circle-color": ["case", [">", ["get", "exact_count"], 0], "#14b8a6", "#f59e0b"],
      "circle-opacity": 0.94,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  addMapLayer(map, {
    id: "rzreg-data-centre-cluster-count",
    type: "symbol",
    source: "rzreg-data-centres",
    filter: ["has", "point_count"],
    layout: {
      visibility: showDataCentresRef.current ? "visible" : "none",
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
    },
    paint: { "text-color": "#07111f" },
  });
  addMapLayer(map, {
    id: "rzreg-data-centres-approximate-area",
    type: "circle",
    source: "rzreg-data-centres",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "location_precision"], "postcode_area"],
    ],
    layout: { visibility: showDataCentresRef.current ? "visible" : "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 7, 10, 13, 14, 24],
      "circle-color": "rgba(245, 158, 11, 0.08)",
      "circle-stroke-color": "rgba(245, 158, 11, 0.48)",
      "circle-stroke-width": 1.25,
    },
  });
  addMapLayer(map, {
    id: "rzreg-data-centres-approximate",
    type: "circle",
    source: "rzreg-data-centres",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "location_precision"], "postcode_area"],
    ],
    layout: { visibility: showDataCentresRef.current ? "visible" : "none" },
    paint: {
      "circle-radius": 6,
      "circle-color": "rgba(245, 158, 11, 0.16)",
      "circle-stroke-color": "#f59e0b",
      "circle-stroke-width": 2,
    },
  });
  addMapLayer(map, {
    id: "rzreg-data-centres-exact",
    type: "circle",
    source: "rzreg-data-centres",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "location_precision"], "facility_address"],
    ],
    layout: { visibility: showDataCentresRef.current ? "visible" : "none" },
    paint: {
      "circle-radius": 7,
      "circle-color": "#14b8a6",
      "circle-stroke-color": "#ecfeff",
      "circle-stroke-width": 2.5,
    },
  });
  const showDataCentre = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const properties = feature.properties ?? {};
    onDataCentreSelectRef.current?.({
      id: String(properties.id ?? feature.id ?? "rzreg-data-centre"),
      rzregRow: Number(properties.rzreg_row ?? 0),
      name: String(properties.name ?? "RZReg data centre"),
      operator: String(properties.operator ?? "Operator not published"),
      postcode: String(properties.postcode ?? ""),
      address: properties.address ? String(properties.address) : null,
      locationPrecision:
        properties.location_precision === "facility_address" ? "facility_address" : "postcode_area",
      coordinateMethod: String(properties.coordinate_method ?? "unknown"),
      truthLabel: String(properties.truth_label ?? "withheld_or_unknown"),
      sourceUrl: properties.source_url ? String(properties.source_url) : null,
      warning: properties.warning ? String(properties.warning) : null,
      coordinates: feature.geometry.coordinates as [number, number],
    });
  };
  for (const layer of ["rzreg-data-centres-exact", "rzreg-data-centres-approximate"]) {
    map.on("click", layer, showDataCentre);
    map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
  }
}
