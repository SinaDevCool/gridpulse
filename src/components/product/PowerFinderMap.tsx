import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Source } from "maplibre-gl";
import type {
  PowerFinderCollection,
  PowerFinderFeature,
} from "@/features/power-finder/fixture-data";
import type { PowerFinderBounds } from "@/features/power-finder/data-source";

type PowerFinderMapProps = {
  collection: PowerFinderCollection;
  selectedId: string | null;
  onSelect: (feature: PowerFinderFeature) => void;
  onViewportChange?: (bounds: PowerFinderBounds) => void;
};

function isGeoJsonSource(source: Source | undefined): source is GeoJSONSource {
  return source?.type === "geojson";
}

export function PowerFinderMap({
  collection,
  selectedId,
  onSelect,
  onViewportChange,
}: PowerFinderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewportChangeRef = useRef(onViewportChange);
  const collectionRef = useRef(collection);
  onSelectRef.current = onSelect;
  onViewportChangeRef.current = onViewportChange;
  collectionRef.current = collection;

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
        map.addSource("power-finder", {
          type: "geojson",
          data: collectionRef.current,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 38,
        });
        map.addLayer({
          id: "industrial-sites",
          type: "fill",
          source: "power-finder",
          filter: ["==", ["get", "kind"], "industrial_site"],
          paint: {
            "fill-color": "#17c3b2",
            "fill-opacity": 0.2,
            "fill-outline-color": "#5eead4",
          },
        });
        map.addLayer({
          id: "grid-lines",
          type: "line",
          source: "power-finder",
          filter: ["==", ["get", "kind"], "line"],
          paint: {
            "line-color": [
              "case",
              [">=", ["at", 0, ["get", "voltage_kv"]], 220],
              "#60a5fa",
              "#7dd3fc",
            ],
            "line-width": 2.2,
            "line-opacity": 0.85,
          },
        });
        map.addLayer({
          id: "node-clusters",
          type: "circle",
          source: "power-finder",
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
          source: "power-finder",
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
          source: "power-finder",
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "kind"], "node"]],
          paint: {
            "circle-radius": 7,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#fff7d6",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "generation-assets",
          type: "circle",
          source: "power-finder",
          filter: ["==", ["get", "kind"], "generation_asset"],
          paint: {
            "circle-radius": 4,
            "circle-color": "#22c55e",
            "circle-stroke-color": "#dcfce7",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "storage-assets",
          type: "circle",
          source: "power-finder",
          filter: ["==", ["get", "kind"], "storage_asset"],
          paint: {
            "circle-radius": 5,
            "circle-color": "#a855f7",
            "circle-stroke-color": "#f3e8ff",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "selected-node",
          type: "circle",
          source: "power-finder",
          filter: ["==", ["id"], "__none__"],
          paint: {
            "circle-radius": 12,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });

        const selectFeature = (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.id;
          const feature = collectionRef.current.features.find(
            (item) => String(item.id) === String(id),
          );
          if (feature) onSelectRef.current(feature);
        };
        for (const layer of ["grid-nodes", "industrial-sites"]) {
          map.on("click", layer, selectFeature);
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
        map.on("click", "node-clusters", (event) => {
          const cluster = event.features?.[0];
          const clusterId = cluster?.properties?.cluster_id;
          if (!cluster || typeof clusterId !== "number" || cluster.geometry.type !== "Point")
            return;
          const coordinates = cluster.geometry.coordinates as [number, number];
          const source = map.getSource("power-finder");
          if (!isGeoJsonSource(source)) return;
          void source.getClusterExpansionZoom(clusterId).then((zoom) => {
            map.easeTo({
              center: coordinates,
              zoom,
              duration: 450,
            });
          });
        });
        map.on("mouseenter", "node-clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "node-clusters", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("moveend", () => {
          const bounds = map.getBounds();
          onViewportChangeRef.current?.({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          });
        });
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource("power-finder");
    if (isGeoJsonSource(source)) source.setData(collection);
  }, [collection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("selected-node")) return;
    map.setFilter("selected-node", ["==", ["id"], selectedId ?? "__none__"]);
    const selected = collection.features.find((feature) => feature.id === selectedId);
    if (selected?.geometry.type === "Point") {
      map.easeTo({ center: selected.geometry.coordinates as [number, number], duration: 500 });
    }
  }, [collection, selectedId]);

  return (
    <div
      ref={containerRef}
      className="power-finder-map"
      role="application"
      aria-label="Interactive grid and industrial-site screening map"
    />
  );
}
