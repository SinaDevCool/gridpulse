import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Source } from "maplibre-gl";
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
import type { CapacityMetric } from "@/features/power-finder/calculated-capacity";

const sourceIds = {
  node: "power-finder-nodes",
  line: "power-finder-lines",
  industrial_site: "power-finder-industrial-sites",
  generation_asset: "power-finder-generation-assets",
  storage_asset: "power-finder-storage-assets",
} as const;

type PowerFinderMapProps = {
  collection: PowerFinderCollection;
  enabledLayers: Record<PowerFinderFeature["properties"]["kind"], boolean>;
  selectedFeature?: PowerFinderFeature | null;
  previewFeature?: PowerFinderFeature | null;
  mapMode: "voltage" | "evidence" | "capacity";
  capacityNodes?: CalculatedCapacityNode[];
  capacityMetric?: CapacityMetric;
  requiredCapacityMw?: number;
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
    line:
      renderedFeatureCount(map, "national-grid-lines") + renderedFeatureCount(map, "grid-lines"),
    industrial_site:
      renderedFeatureCount(map, "national-industrial-sites") +
      renderedFeatureCount(map, "industrial-sites"),
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
        map.addSource("power-finder-national-tiles", {
          type: "vector",
          tiles: [
            `${window.location.origin}/api/power-finder/tile/{z}/{x}/{y}?release=20260810-progressive-3`,
          ],
          minzoom: 4,
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
            "line-color": [
              "case",
              ["in", "380", ["to-string", ["get", "voltage_kv"]]],
              "#c084fc",
              ["in", "220", ["to-string", ["get", "voltage_kv"]]],
              "#60a5fa",
              "#7dd3fc",
            ],
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 1.8],
            "line-opacity": 0.82,
          },
        });
        map.addLayer({
          id: "national-grid-nodes",
          type: "circle",
          source: "power-finder-national-tiles",
          "source-layer": "power_finder",
          minzoom: 8.5,
          maxzoom: 24,
          filter: ["==", ["get", "kind"], "node"],
          layout: { visibility: enabledLayers.node ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8.5, 1.2, 11, 4.5],
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#fff7d6",
            "circle-stroke-width": 1,
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
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 1.4, 10, 4],
            "circle-color": "#17c3b2",
            "circle-stroke-color": "#99f6e4",
            "circle-stroke-width": 1,
            "circle-opacity": 0.78,
          },
        });
        map.addLayer({
          id: "national-generation-density",
          type: "heatmap",
          source: "power-finder-national-tiles",
          "source-layer": "power_finder",
          minzoom: 6,
          maxzoom: 9,
          filter: ["==", ["get", "kind"], "generation_asset"],
          layout: { visibility: enabledLayers.generation_asset ? "visible" : "none" },
          paint: {
            "heatmap-weight": 0.65,
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, 0.35, 9, 0.8],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 9, 9, 16],
            "heatmap-opacity": 0.72,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(34,197,94,0)",
              0.35,
              "rgba(34,197,94,0.35)",
              0.7,
              "#4ade80",
              1,
              "#dcfce7",
            ],
          },
        });
        map.addLayer({
          id: "national-generation-assets",
          type: "circle",
          source: "power-finder-national-tiles",
          "source-layer": "power_finder",
          minzoom: 9,
          maxzoom: 24,
          filter: ["==", ["get", "kind"], "generation_asset"],
          layout: { visibility: enabledLayers.generation_asset ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2, 9, 4],
            "circle-color": "#22c55e",
            "circle-stroke-color": "#dcfce7",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "national-storage-assets",
          type: "circle",
          source: "power-finder-national-tiles",
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
            "line-color": [
              "step",
              ["number", ["get", "max_voltage_kv"], 0],
              "#64748b",
              20,
              "#2dd4bf",
              110,
              "#7dd3fc",
              220,
              "#60a5fa",
              380,
              "#c084fc",
            ],
            "line-width": [
              "step",
              ["number", ["get", "max_voltage_kv"], 0],
              1.2,
              110,
              1.8,
              220,
              2.4,
              380,
              3,
            ],
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
            "circle-color": "#22c55e",
            "circle-stroke-color": "#dcfce7",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "generation-cluster-count",
          type: "symbol",
          source: sourceIds.generation_asset,
          layout: { visibility: "none", "text-field": ["get", "point_count_abbreviated"], "text-size": 10 },
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
            "circle-color": "#22c55e",
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
          layout: { visibility: "none", "text-field": ["get", "point_count_abbreviated"], "text-size": 10 },
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
          const id = event.features?.[0]?.id;
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
    const split = splitMapCollection(
      withCapacityResults(collection, capacityNodes, capacityMetric, requiredCapacityMw),
    );
    const updates = [
      [sourceIds.node, split.nodes],
      [sourceIds.line, split.lines],
      [sourceIds.industrial_site, split.industrialSites],
      [sourceIds.generation_asset, split.generationAssets],
      [sourceIds.storage_asset, split.storageAssets],
    ] as const;
    for (const [sourceId, data] of updates) {
      const source = map.getSource(sourceId);
      if (isGeoJsonSource(source)) source.setData(data);
    }
    const nationalLayers = {
      "national-grid-lines": enabledLayers.line,
      "national-grid-nodes": enabledLayers.node,
      "national-industrial-sites": enabledLayers.industrial_site,
      "national-industrial-overview": enabledLayers.industrial_site,
      "national-generation-density": enabledLayers.generation_asset,
      "national-generation-assets": enabledLayers.generation_asset,
      "national-storage-assets": enabledLayers.storage_asset,
    } as const;
    for (const [layer, visible] of Object.entries(nationalLayers)) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
    }
  }, [collection, capacityNodes, capacityMetric, requiredCapacityMw, enabledLayers]);

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
    const voltageColour = [
      "step",
      ["number", ["get", "max_voltage_kv"], 0],
      "#64748b",
      20,
      "#2dd4bf",
      110,
      "#f59e0b",
      220,
      "#f97316",
      380,
      "#ef4444",
    ];
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
        mapMode === "capacity" ? "#475569" : "#f59e0b",
      );
      map.setPaintProperty(
        "national-grid-nodes",
        "circle-stroke-color",
        mapMode === "capacity" ? "#cbd5e1" : "#fff7d6",
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
