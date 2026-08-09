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

const sourceIds = {
  node: "power-finder-nodes",
  line: "power-finder-lines",
  industrial_site: "power-finder-industrial-sites",
  generation_asset: "power-finder-generation-assets",
  storage_asset: "power-finder-storage-assets",
} as const;

type PowerFinderMapProps = {
  collection: PowerFinderCollection;
  selectedFeature?: PowerFinderFeature | null;
  previewFeature?: PowerFinderFeature | null;
  mapMode: "voltage" | "evidence" | "capacity";
  capacityNodes?: CalculatedCapacityNode[];
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
    line: renderedFeatureCount(map, "grid-lines"),
    industrial_site: renderedFeatureCount(map, "industrial-sites"),
  });
}

export function PowerFinderMap({
  collection,
  selectedFeature,
  previewFeature,
  mapMode,
  capacityNodes = [],
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
  onSelectRef.current = onSelect;
  onViewportChangeRef.current = onViewportChange;
  collectionRef.current = collection;
  projectSiteRef.current = projectSite;
  onSitePlacementRef.current = onSitePlacement;
  onVisibleLayerCountsRef.current = onVisibleLayerCounts;
  selectedFeatureRef.current = selectedFeature;
  previewFeatureRef.current = previewFeature;
  capacityNodesRef.current = capacityNodes;

  const withCapacity = (value: PowerFinderCollection) => {
    const byNode = new Map(capacityNodesRef.current.map((result) => [result.publicNodeId, result]));
    return {
      ...value,
      features: value.features.map((feature) => {
        const result = byNode.get(String(feature.id));
        return result
          ? ({
              ...feature,
              properties: {
                ...feature.properties,
                calculated_capacity_mw: result.valueMw,
                capacity_validation_state: result.validationState,
              },
            } as PowerFinderFeature)
          : feature;
      }),
    };
  };

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
        const split = splitMapCollection(withCapacity(collectionRef.current));
        map.addSource(sourceIds.node, {
          type: "geojson",
          data: split.nodes,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 38,
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
          id: "industrial-sites",
          type: "fill",
          source: sourceIds.industrial_site,
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
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 11,
          },
          paint: { "text-color": "#07111f" },
        });
        map.addLayer({
          id: "grid-nodes",
          type: "circle",
          source: sourceIds.node,
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
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 10 },
          paint: { "text-color": "#052e16" },
        });
        map.addLayer({
          id: "generation-assets",
          type: "circle",
          source: sourceIds.generation_asset,
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
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 10 },
          paint: { "text-color": "#2e1065" },
        });
        map.addLayer({
          id: "storage-assets",
          type: "circle",
          source: sourceIds.storage_asset,
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
    const split = splitMapCollection(withCapacity(collection));
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
  }, [collection, capacityNodes]);

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
      "case",
      ["==", ["get", "capacity_validation_state"], "stale"],
      "#f59e0b",
      ["!", ["has", "calculated_capacity_mw"]],
      "#475569",
      [
        "interpolate",
        ["linear"],
        ["number", ["get", "calculated_capacity_mw"], 0],
        0,
        "#164e63",
        20,
        "#0891b2",
        50,
        "#22d3ee",
        100,
        "#a5f3fc",
      ],
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
    map.setPaintProperty("grid-nodes", "circle-radius", mapMode === "capacity" ? 9 : 7);
    map.setPaintProperty(
      "grid-nodes",
      "circle-stroke-color",
      mapMode === "capacity"
        ? [
            "match",
            ["get", "capacity_validation_state"],
            "operator_confirmed",
            "#4ade80",
            "operator_reviewed",
            "#ffffff",
            "stale",
            "#fbbf24",
            "#cbd5e1",
          ]
        : "#fff7d6",
    );
  }, [mapMode, capacityNodes]);

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
