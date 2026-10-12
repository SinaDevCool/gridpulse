import { addMapSource } from "./registration";
import { splitMapCollection } from "@/components/product/power-finder-map-data";
import type { FeatureCollection, Point } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { isGeoJsonSource, withCapacityResults } from "./feature-selection";
import { sourceIds } from "./layer-style";
import type { MapResources } from "./resource-contract";
export function registerSources(
  map: MapLibreMap,
  resources: Pick<
    MapResources,
    | "collectionRef"
    | "projectSiteRef"
    | "discoveryLocationsRef"
    | "capacityNodesRef"
    | "capacityMetricRef"
    | "requiredCapacityMwRef"
    | "capacityCoverageRef"
    | "onDataSourceStatusChangeRef"
    | "runtimeSourceStatusRef"
  >,
  isCancelled: () => boolean,
) {
  const {
    collectionRef,
    projectSiteRef,
    discoveryLocationsRef,
    capacityNodesRef,
    capacityMetricRef,
    requiredCapacityMwRef,
    capacityCoverageRef,
    onDataSourceStatusChangeRef,
    runtimeSourceStatusRef,
  } = resources;
  const split = splitMapCollection(
    withCapacityResults(
      collectionRef.current,
      capacityNodesRef.current,
      capacityMetricRef.current,
      requiredCapacityMwRef.current,
    ),
  );
  addMapSource(map, sourceIds.node, {
    type: "geojson",
    data: split.nodes,
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 38,
    clusterProperties: {
      capacity_meets: ["+", ["number", ["get", "capacity_meets"], 0]],
      capacity_activation: ["+", ["number", ["get", "capacity_activation"], 0]],
    },
  });
  addMapSource(map, sourceIds.line, { type: "geojson", data: split.lines });
  addMapSource(map, sourceIds.industrial_site, {
    type: "geojson",
    data: split.industrialSites,
  });
  addMapSource(map, sourceIds.generation_asset, {
    type: "geojson",
    data: split.generationAssets,
    cluster: true,
    // Registry records often share an official publication coordinate.
    // Keep those co-located assets aggregated at close zooms so their
    // summed registered MW does not collapse into overlapping points.
    clusterMaxZoom: 17,
    clusterRadius: 34,
    clusterProperties: {
      registered_mw: ["+", ["number", ["get", "net_capacity_mw"], 0]],
      known_mw_count: ["+", ["case", ["has", "net_capacity_mw"], 1, 0]],
      solar_count: ["+", ["case", ["==", ["get", "generation_group"], "solar"], 1, 0]],
      wind_count: ["+", ["case", ["==", ["get", "generation_group"], "wind"], 1, 0]],
      other_count: [
        "+",
        ["case", ["in", ["get", "generation_group"], ["literal", ["solar", "wind"]]], 0, 1],
      ],
    },
  });
  addMapSource(map, sourceIds.storage_asset, {
    type: "geojson",
    data: split.storageAssets,
    cluster: true,
    clusterMaxZoom: 17,
    clusterRadius: 34,
    clusterProperties: {
      registered_mw: ["+", ["number", ["get", "net_capacity_mw"], 0]],
      known_mw_count: ["+", ["case", ["has", "net_capacity_mw"], 1, 0]],
    },
  });
  addMapSource(map, "berlin-capacity-coverage", {
    type: "geojson",
    data: capacityCoverageRef.current ?? { type: "FeatureCollection", features: [] },
  });
  addMapSource(map, "power-finder-national-tiles", {
    type: "vector",
    promoteId: "id",
    tiles: [
      `${window.location.origin}/api/power-finder/tile/{z}/{x}/{y}?content=grid&generation=false&storage=false`,
    ],
    minzoom: 4,
    // Overzoom the cached national z8 tile immediately. Finer distribution
    // detail is supplied by the bounded viewport GeoJSON source as it arrives.
    maxzoom: 8,
  });
  addMapSource(map, "power-finder-registry-tiles", {
    type: "vector",
    tiles: [
      `${window.location.origin}/api/power-finder/tile/{z}/{x}/{y}?content=registry&v=20260926-tech-clusters-v2`,
    ],
    minzoom: 4,
    // Request finer registry tiles so dense exact-location assets do not
    // remain packed into an overzoomed country-scale z8 tile.
    maxzoom: 14,
  });
  onDataSourceStatusChangeRef.current?.(runtimeSourceStatusRef.current);
  map.on("sourcedata", (event) => {
    if (!event.isSourceLoaded) return;
    if (
      event.sourceId !== "power-finder-national-tiles" &&
      event.sourceId !== "power-finder-registry-tiles"
    )
      return;
    const key = event.sourceId === "power-finder-national-tiles" ? "grid" : "registry";
    runtimeSourceStatusRef.current = { ...runtimeSourceStatusRef.current, [key]: "ready" };
    globalThis.performance?.mark(`gridpulse-map-${key}-ready`);
    onDataSourceStatusChangeRef.current?.(runtimeSourceStatusRef.current);
  });
  addMapSource(map, "finder-project-site", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: projectSiteRef.current
        ? [
            {
              type: "Feature",
              properties: { kind: "project_site" },
              geometry: { type: "Point", coordinates: projectSiteRef.current },
            },
          ]
        : [],
    },
  });
  addMapSource(map, "finder-discovery-locations", {
    type: "geojson",
    data: discoveryLocationsRef.current ?? { type: "FeatureCollection", features: [] },
  });
  addMapSource(map, "rzreg-data-centres", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 38,
    clusterProperties: {
      exact_count: ["+", ["case", ["==", ["get", "location_precision"], "facility_address"], 1, 0]],
    },
  });
  void fetch("/power-finder/rzreg-data-centres.json")
    .then((response) => {
      if (!response.ok) throw new Error(`RZReg map data returned ${response.status}`);
      return response.json() as Promise<FeatureCollection<Point>>;
    })
    .then((data) => {
      const source = map.getSource("rzreg-data-centres");
      if (isGeoJsonSource(source)) source.setData(data);
    })
    .catch(() => {
      // The grid map remains usable when this contextual public-data layer is unavailable.
    });
}
