import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef } from "react";
import type { FeatureCollection, Polygon } from "geojson";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Source,
} from "maplibre-gl";
import type {
  PowerFinderCollection,
  PowerFinderFeature,
} from "@/features/power-finder/fixture-data";
import type { PowerFinderBounds } from "@/features/power-finder/data-source";
import {
  splitMapCollection,
  type VisibleLayerCounts,
} from "@/components/product/power-finder-map-data";
import type { CalculatedCapacityNode } from "@/features/power-finder/calculated-capacity";
import { classifyCapacityOpportunity } from "@/features/power-finder/capacity-opportunity";
import {
  voltageColorExpression,
  voltageWidthExpression,
} from "@/features/power-finder/voltage-style";
import type { CapacityMetric } from "@/features/power-finder/calculated-capacity";

const sourceIds = {
  node: "power-finder-nodes",
  line: "power-finder-lines",
  industrial_site: "power-finder-industrial-sites",
  generation_asset: "power-finder-generation-assets",
  storage_asset: "power-finder-storage-assets",
} as const;

const generationColour: ExpressionSpecification = [
  "match",
  ["get", "generation_group"],
  "solar",
  "#facc15",
  "wind",
  "#38bdf8",
  "biomass",
  "#22c55e",
  "hydro",
  "#06b6d4",
  "geothermal",
  "#f97316",
  "gas",
  "#a78bfa",
  "fossil_other",
  "#ef4444",
  "nuclear",
  "#f472b6",
  "#94a3b8",
];
const localGenerationColour: ExpressionSpecification = [
  "match",
  ["get", "technology"],
  "Solare Strahlungsenergie",
  "#facc15",
  "Solarthermie",
  "#facc15",
  "Wind",
  "#38bdf8",
  "Biomasse",
  "#22c55e",
  "Wasser",
  "#06b6d4",
  "Geothermie",
  "#f97316",
  "Erdgas",
  "#a78bfa",
  "andere Gase",
  "#a78bfa",
  "Grubengas",
  "#a78bfa",
  "Kernenergie",
  "#f472b6",
  "#ef4444",
];

type PowerFinderMapProps = {
  collection: PowerFinderCollection;
  enabledLayers: Record<PowerFinderFeature["properties"]["kind"], boolean>;
  selectedFeature?: PowerFinderFeature | null;
  previewFeature?: PowerFinderFeature | null;
  mapMode: "voltage" | "evidence" | "capacity";
  capacityNodes?: CalculatedCapacityNode[];
  capacityMetric?: CapacityMetric;
  requiredCapacityMw?: number;
  capacityCoverage?: FeatureCollection<Polygon> | null;
  viewportTarget?: { center: [number, number]; zoom: number };
  onSelect: (feature: PowerFinderFeature) => void;
  onViewportChange?: (bounds: PowerFinderBounds) => void;
  projectSite?: [number, number] | null;
  onSitePlacement?: (coordinates: [number, number]) => void;
  onVisibleLayerCounts?: (counts: VisibleLayerCounts) => void;
};

function isGeoJsonSource(source: Source | undefined): source is GeoJSONSource {
  return source?.type === "geojson";
}

function renderedFeatureCount(map: MapLibreMap, layer: string) {
  if (!map.getLayer(layer)) return 0;
  const identifiers = new Set(
    map
      .queryRenderedFeatures({ layers: [layer] })
      .map((feature) =>
        String(feature.id ?? feature.properties?.name ?? JSON.stringify(feature.geometry)),
      ),
  );
  return identifiers.size;
}

function publishVisibleLayerCounts(
  map: MapLibreMap,
  callback: ((counts: VisibleLayerCounts) => void) | undefined,
) {
  callback?.({
    node:
      renderedFeatureCount(map, "national-grid-nodes") + renderedFeatureCount(map, "grid-nodes"),
    line:
      renderedFeatureCount(map, "national-grid-lines") + renderedFeatureCount(map, "grid-lines"),
    industrial_site:
      renderedFeatureCount(map, "national-industrial-sites") +
      renderedFeatureCount(map, "industrial-sites"),
    generation_asset:
      renderedFeatureCount(map, "national-generation-overview") +
      renderedFeatureCount(map, "national-generation-assets") +
      renderedFeatureCount(map, "generation-assets"),
    storage_asset:
      renderedFeatureCount(map, "national-storage-assets") +
      renderedFeatureCount(map, "storage-assets"),
  });
}

function withCapacityResults(
  value: PowerFinderCollection,
  capacityNodes: CalculatedCapacityNode[],
  capacityMetric: CapacityMetric,
  requiredCapacityMw: number,
) {
  const byNode = new Map(capacityNodes.map((result) => [result.publicNodeId, result]));
  return {
    ...value,
    features: value.features.map((feature) => {
      const result = byNode.get(String(feature.id));
      const opportunity = classifyCapacityOpportunity(result, capacityMetric, requiredCapacityMw);
      return result
        ? ({
            ...feature,
            properties: {
              ...feature.properties,
              ...(result.valueMw === null ? {} : { calculated_capacity_mw: result.valueMw }),
              capacity_validation_state: result.validationState,
              capacity_fit: opportunity.fit,
              capacity_ratio: opportunity.coverageRatio ?? 0,
              capacity_meets: opportunity.fit === "meets" ? 1 : 0,
              capacity_activation: opportunity.fit === "activation" ? 1 : 0,
            },
          } as PowerFinderFeature)
        : feature;
    }),
  };
}

export function PowerFinderMap({
  collection,
  enabledLayers,
  selectedFeature,
  previewFeature,
  mapMode,
  capacityNodes = [],
  capacityMetric = "firm_import_mw",
  requiredCapacityMw = 1,
  capacityCoverage = null,
  viewportTarget,
  onSelect,
  onViewportChange,
  projectSite,
  onSitePlacement,
  onVisibleLayerCounts,
}: PowerFinderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewportChangeRef = useRef(onViewportChange);
  const collectionRef = useRef(collection);
  const projectSiteRef = useRef(projectSite);
  const onSitePlacementRef = useRef(onSitePlacement);
  const onVisibleLayerCountsRef = useRef(onVisibleLayerCounts);
  const selectedFeatureRef = useRef(selectedFeature);
  const previewFeatureRef = useRef(previewFeature);
  const capacityNodesRef = useRef(capacityNodes);
  const capacityMetricRef = useRef(capacityMetric);
  const requiredCapacityMwRef = useRef(requiredCapacityMw);
  const capacityCoverageRef = useRef(capacityCoverage);
  onSelectRef.current = onSelect;
  onViewportChangeRef.current = onViewportChange;
  collectionRef.current = collection;
  projectSiteRef.current = projectSite;
  onSitePlacementRef.current = onSitePlacement;
  onVisibleLayerCountsRef.current = onVisibleLayerCounts;
  selectedFeatureRef.current = selectedFeature;
  previewFeatureRef.current = previewFeature;
  capacityNodesRef.current = capacityNodes;
  capacityMetricRef.current = capacityMetric;
  requiredCapacityMwRef.current = requiredCapacityMw;
  capacityCoverageRef.current = capacityCoverage;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    void import("maplibre-gl").then(({ Map, NavigationControl }) => {
      if (cancelled || !containerRef.current) return;
      const map = new Map({
        container: containerRef.current,
        center: [13.36, 52.31],
        zoom: 9.1,
        attributionControl: {},
        style: {
          version: 8,
          sources: {
            carto: {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors © CARTO",
            },
          },
          layers: [{ id: "carto", type: "raster", source: "carto" }],
        },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        const split = splitMapCollection(
          withCapacityResults(
            collectionRef.current,
            capacityNodesRef.current,
            capacityMetricRef.current,
            requiredCapacityMwRef.current,
          ),
        );
        map.addSource(sourceIds.node, {
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
        map.addSource(sourceIds.line, { type: "geojson", data: split.lines });
        map.addSource(sourceIds.industrial_site, {
          type: "geojson",
          data: split.industrialSites,
        });
        map.addSource(sourceIds.generation_asset, {
          type: "geojson",
          data: split.generationAssets,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 34,
        });
        map.addSource(sourceIds.storage_asset, {
          type: "geojson",
          data: split.storageAssets,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 34,
        });
        map.addSource("berlin-capacity-coverage", {
          type: "geojson",
          data: capacityCoverageRef.current ?? { type: "FeatureCollection", features: [] },
        });
        map.addSource("power-finder-national-tiles", {
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
        map.addSource("power-finder-registry-tiles", {
          type: "vector",
          tiles: [`${window.location.origin}/api/power-finder/tile/{z}/{x}/{y}?content=registry`],
          minzoom: 8,
          // Request finer registry tiles so dense exact-location assets do not
          // remain packed into an overzoomed country-scale z8 tile.
          maxzoom: 10,
        });
        map.addSource("finder-project-site", {
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
        const highlighted = previewFeatureRef.current ?? selectedFeatureRef.current;
        map.addSource("finder-selected-candidate", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: highlighted?.geometry.type === "Point" ? [highlighted] : [],
          },
        });
        map.addLayer({
          id: "berlin-capacity-coverage-fill",
          type: "fill",
          source: "berlin-capacity-coverage",
          layout: { visibility: "none" },
          paint: { "fill-color": "#38bdf8", "fill-opacity": 0.055 },
        });
        map.addLayer({
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
        map.addLayer({
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
        map.addLayer({
          id: "national-grid-lines",
          type: "line",
          source: "power-finder-national-tiles",
          "source-layer": "power_finder",
          minzoom: 4,
          maxzoom: 24,
          filter: ["==", ["get", "kind"], "line"],
          layout: { visibility: enabledLayers.line ? "visible" : "none" },
          paint: {
            "line-color": voltageColorExpression(),
            "line-width": voltageWidthExpression(),
            "line-opacity": 0.82,
          },
        });
        map.addLayer({
          id: "national-grid-nodes",
          type: "circle",
          source: "power-finder-national-tiles",
          "source-layer": "power_finder",
          minzoom: 4,
          maxzoom: 24,
          filter: ["==", ["get", "kind"], "node"],
          layout: { visibility: enabledLayers.node ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1, 7, 1.6, 8.5, 2.5, 11, 4.5],
            "circle-color": "#f59e0b",
            "circle-stroke-color": voltageColorExpression(),
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 9, 1],
          },
        });
        map.addLayer({
          id: "national-industrial-sites",
          type: "fill",
          source: "power-finder-national-tiles",
          "source-layer": "power_finder",
          minzoom: 8,
          maxzoom: 24,
          filter: ["==", ["get", "kind"], "industrial_site"],
          layout: { visibility: enabledLayers.industrial_site ? "visible" : "none" },
          paint: {
            "fill-color": "#17c3b2",
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.28, 16, 0.48],
            "fill-outline-color": "#5eead4",
          },
        });
        map.addLayer({
          id: "national-industrial-overview",
          type: "circle",
          source: "power-finder-national-tiles",
          "source-layer": "power_finder",
          minzoom: 8,
          maxzoom: 10,
          filter: ["==", ["get", "kind"], "industrial_site"],
          layout: { visibility: enabledLayers.industrial_site ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.2, 10, 5],
            "circle-color": "rgba(7, 17, 31, 0.75)",
            "circle-stroke-color": "#99f6e4",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.95,
          },
        });
        map.addLayer({
          id: "national-generation-overview",
          type: "circle",
          source: "power-finder-registry-tiles",
          "source-layer": "power_finder",
          minzoom: 6,
          maxzoom: 9,
          filter: ["==", ["get", "kind"], "generation_asset"],
          layout: { visibility: enabledLayers.generation_asset ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 0.35, 9, 1.1],
            "circle-color": generationColour,
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.2, 9, 0.55],
            "circle-stroke-width": 0,
          },
        });
        map.addLayer({
          id: "national-generation-assets",
          type: "circle",
          source: "power-finder-registry-tiles",
          "source-layer": "power_finder",
          minzoom: 9,
          maxzoom: 24,
          filter: ["==", ["get", "kind"], "generation_asset"],
          layout: { visibility: enabledLayers.generation_asset ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2, 9, 4],
            "circle-color": generationColour,
            "circle-stroke-color": "#dcfce7",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "national-storage-assets",
          type: "circle",
          source: "power-finder-registry-tiles",
          "source-layer": "power_finder",
          minzoom: 6,
          maxzoom: 24,
          filter: ["==", ["get", "kind"], "storage_asset"],
          layout: { visibility: enabledLayers.storage_asset ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 9, 5],
            "circle-color": "#a855f7",
            "circle-stroke-color": "#f3e8ff",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "industrial-sites",
          type: "fill",
          source: sourceIds.industrial_site,
          layout: { visibility: "none" },
          paint: {
            "fill-color": "#17c3b2",
            "fill-opacity": 0.2,
            "fill-outline-color": "#5eead4",
          },
        });
        map.addLayer({
          id: "grid-lines",
          type: "line",
          source: sourceIds.line,
          minzoom: 8,
          layout: { visibility: "none" },
          paint: {
            "line-color": voltageColorExpression(),
            "line-width": voltageWidthExpression(),
            "line-opacity": 0.85,
          },
        });
        map.addLayer({
          id: "node-clusters",
          type: "circle",
          source: sourceIds.node,
          minzoom: 8,
          layout: { visibility: "none" },
          filter: ["has", "point_count"],
          paint: {
            "circle-radius": ["step", ["get", "point_count"], 15, 25, 19, 100, 24],
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#f59e0b",
              25,
              "#f97316",
              100,
              "#ef4444",
            ],
            "circle-stroke-color": "#fff7d6",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "node-cluster-count",
          type: "symbol",
          source: sourceIds.node,
          minzoom: 8,
          filter: ["has", "point_count"],
          layout: {
            visibility: "none",
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 11,
          },
          paint: { "text-color": "#07111f" },
        });
        map.addLayer({
          id: "grid-nodes",
          type: "circle",
          source: sourceIds.node,
          minzoom: 8,
          layout: { visibility: "none" },
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 7,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#fff7d6",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "generation-clusters",
          type: "circle",
          source: sourceIds.generation_asset,
          layout: { visibility: "none" },
          filter: ["has", "point_count"],
          paint: {
            "circle-radius": ["step", ["get", "point_count"], 12, 20, 16, 100, 20],
            "circle-color": localGenerationColour,
            "circle-stroke-color": "#dcfce7",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "generation-cluster-count",
          type: "symbol",
          source: sourceIds.generation_asset,
          layout: {
            visibility: "none",
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 10,
          },
          filter: ["has", "point_count"],
          paint: { "text-color": "#052e16" },
        });
        map.addLayer({
          id: "generation-assets",
          type: "circle",
          source: sourceIds.generation_asset,
          layout: { visibility: "none" },
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 4,
            "circle-color": localGenerationColour,
            "circle-stroke-color": "#dcfce7",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "storage-clusters",
          type: "circle",
          source: sourceIds.storage_asset,
          layout: { visibility: "none" },
          filter: ["has", "point_count"],
          paint: {
            "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 50, 21],
            "circle-color": "#a855f7",
            "circle-stroke-color": "#f3e8ff",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "storage-cluster-count",
          type: "symbol",
          source: sourceIds.storage_asset,
          layout: {
            visibility: "none",
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 10,
          },
          filter: ["has", "point_count"],
          paint: { "text-color": "#2e1065" },
        });
        map.addLayer({
          id: "storage-assets",
          type: "circle",
          source: sourceIds.storage_asset,
          layout: { visibility: "none" },
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 5,
            "circle-color": "#a855f7",
            "circle-stroke-color": "#f3e8ff",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "selected-candidate-halo",
          type: "circle",
          source: "finder-selected-candidate",
          paint: {
            "circle-radius": 18,
            "circle-color": "rgba(56, 215, 242, 0.18)",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 4,
            "circle-blur": 0.15,
          },
        });
        map.addLayer({
          id: "selected-candidate-core",
          type: "circle",
          source: "finder-selected-candidate",
          paint: {
            "circle-radius": 7,
            "circle-color": "#38d7f2",
            "circle-stroke-color": "#07111f",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "selected-candidate-label",
          type: "symbol",
          source: "finder-selected-candidate",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-anchor": "top",
            "text-offset": [0, 1.8],
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#07111f",
            "text-halo-width": 2,
          },
        });

        const selectFeature = (event: MapLayerMouseEvent) => {
          const rendered = event.features?.[0];
          const id = rendered?.id ?? rendered?.properties?.id;
          const feature = collectionRef.current.features.find(
            (item) => String(item.id) === String(id),
          );
          if (feature) onSelectRef.current(feature);
        };
        for (const layer of [
          "grid-nodes",
          "industrial-sites",
          "grid-lines",
          "generation-assets",
          "storage-assets",
          "national-grid-nodes",
          "national-industrial-sites",
          "national-industrial-overview",
          "national-generation-overview",
          "national-generation-assets",
          "national-storage-assets",
        ]) {
          map.on("click", layer, selectFeature);
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
        const registerClusterExpansion = (layer: string, sourceId: string) => {
          map.on("click", layer, (event) => {
            const cluster = event.features?.[0];
            const clusterId = cluster?.properties?.cluster_id;
            if (!cluster || typeof clusterId !== "number" || cluster.geometry.type !== "Point")
              return;
            const coordinates = cluster.geometry.coordinates as [number, number];
            const source = map.getSource(sourceId);
            if (!isGeoJsonSource(source)) return;
            void source.getClusterExpansionZoom(clusterId).then((zoom) => {
              map.easeTo({ center: coordinates, zoom, duration: 450 });
            });
          });
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        };
        registerClusterExpansion("node-clusters", sourceIds.node);
        registerClusterExpansion("generation-clusters", sourceIds.generation_asset);
        registerClusterExpansion("storage-clusters", sourceIds.storage_asset);
        map.on("click", (event) => {
          if (!onSitePlacementRef.current) return;
          const interactive = map.queryRenderedFeatures(event.point, {
            layers: [
              "grid-nodes",
              "industrial-sites",
              "grid-lines",
              "generation-assets",
              "storage-assets",
              "node-clusters",
              "generation-clusters",
              "storage-clusters",
              "national-grid-nodes",
              "national-industrial-sites",
              "national-industrial-overview",
              "national-generation-overview",
              "national-generation-assets",
              "national-storage-assets",
            ],
          });
          if (!interactive.length) {
            onSitePlacementRef.current([event.lngLat.lng, event.lngLat.lat]);
          }
        });
        map.moveLayer("finder-project-site");
        map.moveLayer("selected-candidate-halo");
        map.moveLayer("selected-candidate-core");
        map.moveLayer("selected-candidate-label");
        map.on("moveend", () => {
          const bounds = map.getBounds();
          onViewportChangeRef.current?.({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          });
          publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current);
        });
        map.on("idle", () => publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current));
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const split = splitMapCollection(collection);
    const updates = [
      [sourceIds.line, split.lines],
      [sourceIds.industrial_site, split.industrialSites],
      [sourceIds.generation_asset, split.generationAssets],
      [sourceIds.storage_asset, split.storageAssets],
    ] as const;
    for (const [sourceId, data] of updates) {
      const source = map.getSource(sourceId);
      if (isGeoJsonSource(source)) source.setData(data);
    }
  }, [collection]);

  useEffect(() => {
    const source = mapRef.current?.getSource(sourceIds.node);
    if (!isGeoJsonSource(source)) return;
    const split = splitMapCollection(
      withCapacityResults(collection, capacityNodes, capacityMetric, requiredCapacityMw),
    );
    source.setData(split.nodes);
  }, [collection, capacityNodes, capacityMetric, requiredCapacityMw]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("berlin-capacity-coverage");
    if (isGeoJsonSource(source)) {
      source.setData(capacityCoverage ?? { type: "FeatureCollection", features: [] });
    }
    for (const layer of ["berlin-capacity-coverage-fill", "berlin-capacity-coverage-line"]) {
      if (map?.getLayer(layer)) {
        map.setLayoutProperty(
          layer,
          "visibility",
          mapMode === "capacity" && capacityCoverage ? "visible" : "none",
        );
      }
    }
  }, [capacityCoverage, mapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nationalLayers = {
      "national-grid-lines": enabledLayers.line,
      "national-grid-nodes": enabledLayers.node,
      "national-industrial-sites": enabledLayers.industrial_site,
      "national-industrial-overview": enabledLayers.industrial_site,
      "national-generation-overview": enabledLayers.generation_asset,
      "national-generation-assets": enabledLayers.generation_asset,
      "national-storage-assets": enabledLayers.storage_asset,
    } as const;
    for (const [layer, visible] of Object.entries(nationalLayers)) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
    }
    map.once("idle", () => publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current));
  }, [enabledLayers]);

  useEffect(() => {
    const source = mapRef.current?.getSource("finder-project-site");
    if (!isGeoJsonSource(source)) return;
    source.setData({
      type: "FeatureCollection",
      features: projectSite
        ? [
            {
              type: "Feature",
              properties: { kind: "project_site" },
              geometry: { type: "Point", coordinates: projectSite },
            },
          ]
        : [],
    });
  }, [projectSite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("grid-nodes")) return;
    const voltageColour = voltageColorExpression();
    const evidenceColour = [
      "match",
      ["get", "evidence_class"],
      "official_operator",
      "#4ade80",
      "official_regulatory",
      "#38bdf8",
      "official_public",
      "#60a5fa",
      "open_mapping",
      "#f59e0b",
      "#64748b",
    ];
    const capacityColour = [
      "match",
      ["get", "capacity_fit"],
      "meets",
      "#67e8f9",
      "activation",
      "#818cf8",
      "below",
      "#1e526a",
      "stale",
      "#f59e0b",
      "#475569",
    ];
    const nationalCapacityColour = [
      "match",
      ["feature-state", "capacity_fit"],
      "meets",
      "#67e8f9",
      "activation",
      "#818cf8",
      "below",
      "#1e526a",
      "#475569",
    ];
    const voltageClusterColour = [
      "step",
      ["get", "point_count"],
      "#f59e0b",
      25,
      "#f97316",
      100,
      "#ef4444",
    ];
    const capacityClusterColour = [
      "case",
      [
        ">=",
        ["number", ["get", "capacity_meets"], 0],
        ["*", ["number", ["get", "point_count"], 1], 0.5],
      ],
      "#67e8f9",
      [
        ">",
        [
          "+",
          ["number", ["get", "capacity_meets"], 0],
          ["number", ["get", "capacity_activation"], 0],
        ],
        0,
      ],
      "#a78bfa",
      "#52657a",
    ];
    map.setPaintProperty(
      "grid-nodes",
      "circle-color",
      mapMode === "capacity"
        ? capacityColour
        : mapMode === "evidence"
          ? evidenceColour
          : voltageColour,
    );
    if (map.getLayer("national-grid-nodes")) {
      map.setPaintProperty(
        "national-grid-nodes",
        "circle-color",
        mapMode === "capacity"
          ? nationalCapacityColour
          : mapMode === "evidence"
            ? "#f59e0b"
            : "#f59e0b",
      );
      map.setPaintProperty(
        "national-grid-nodes",
        "circle-stroke-color",
        mapMode === "capacity" ? "#cbd5e1" : mapMode === "voltage" ? voltageColour : "#fff7d6",
      );
      map.setPaintProperty(
        "national-grid-nodes",
        "circle-radius",
        mapMode === "capacity"
          ? 5
          : ["interpolate", ["linear"], ["zoom"], 4, 1, 7, 1.6, 8.5, 2.5, 11, 4.5, 14, 6],
      );
      map.setPaintProperty(
        "national-grid-nodes",
        "circle-opacity",
        mapMode === "capacity" ? 0.92 : 0.88,
      );
    }
    map.setPaintProperty("grid-nodes", "circle-radius", mapMode === "capacity" ? 9 : 7);
    map.setPaintProperty(
      "node-clusters",
      "circle-color",
      mapMode === "capacity" ? capacityClusterColour : voltageClusterColour,
    );
    map.setPaintProperty(
      "node-clusters",
      "circle-stroke-color",
      mapMode === "capacity" ? "#dffaff" : "#fff7d6",
    );
    map.setPaintProperty(
      "grid-nodes",
      "circle-stroke-color",
      mapMode === "capacity"
        ? [
            "case",
            ["==", ["get", "capacity_fit"], "activation"],
            "#c4b5fd",
            ["==", ["get", "capacity_fit"], "below"],
            "#47738a",
            ["==", ["get", "capacity_fit"], "stale"],
            "#fbbf24",
            ["==", ["get", "capacity_validation_state"], "operator_confirmed"],
            "#4ade80",
            ["==", ["get", "capacity_validation_state"], "operator_reviewed"],
            "#ffffff",
            "#cbd5e1",
          ]
        : "#fff7d6",
    );
    const updateNationalCapacityStates = () => {
      if (mapMode !== "capacity" || !map.getSource("power-finder-national-tiles")) return;
      const ids = Array.from(
        new Set(
          map
            .querySourceFeatures("power-finder-national-tiles", {
              sourceLayer: "power_finder",
              filter: ["==", ["get", "kind"], "node"],
            })
            .map((feature) => String(feature.id ?? feature.properties?.id ?? ""))
            .filter(Boolean),
        ),
      );
      const byNode = new Map(capacityNodes.map((node) => [node.publicNodeId, node]));
      for (const id of ids) {
        const node = byNode.get(id);
        const result = classifyCapacityOpportunity(node, capacityMetric, requiredCapacityMw);
        map.setFeatureState(
          { source: "power-finder-national-tiles", sourceLayer: "power_finder", id },
          { capacity_fit: result.fit, capacity_mw: result.valueMw },
        );
      }
    };
    updateNationalCapacityStates();
    map.on("idle", updateNationalCapacityStates);
    return () => {
      map.off("idle", updateNationalCapacityStates);
    };
  }, [mapMode, capacityNodes, capacityMetric, requiredCapacityMw]);

  useEffect(() => {
    if (!viewportTarget || !mapRef.current) return;
    mapRef.current.flyTo({
      center: viewportTarget.center,
      zoom: viewportTarget.zoom,
      duration: 700,
    });
  }, [viewportTarget]);

  useEffect(() => {
    const source = mapRef.current?.getSource("finder-selected-candidate");
    if (!isGeoJsonSource(source)) return;
    const highlighted = previewFeature ?? selectedFeature;
    source.setData({
      type: "FeatureCollection",
      features: highlighted?.geometry.type === "Point" ? [highlighted] : [],
    });
  }, [previewFeature, selectedFeature]);

  return (
    <div
      ref={containerRef}
      className="power-finder-map"
      role="application"
      aria-label="Interactive grid and industrial-site screening map"
      data-selected-feature={selectedFeature?.id ?? ""}
      data-preview-feature={previewFeature?.id ?? ""}
    />
  );
}
