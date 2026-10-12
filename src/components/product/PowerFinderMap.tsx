import "maplibre-gl/dist/maplibre-gl.css";
import { initializeMap } from "../../features/map/initialize-map";
import { useMapResources } from "../../features/map/use-map-resources";

import { useEffect } from "react";

import type { ExpressionSpecification } from "maplibre-gl";

import { splitMapCollection } from "@/components/product/power-finder-map-data";

import { classifyCapacityOpportunity } from "@/features/power-finder/capacity-opportunity";

import { voltageClassFilter,voltageColorExpression } from "@/features/power-finder/voltage-style";

import {
activateDataOnlyBasemap,
applyBasemapVisibility,
} from "@/features/power-finder/basemap-config";

import { type PowerFinderMapProps } from "../../features/map/contracts";

import {
isGeoJsonSource,
publishVisibleLayerCounts,
withCapacityResults,
} from "../../features/map/feature-selection";

import {
applyOverlayTheme,
generationAssetFilter,
registeredCapacityRadius,
sourceIds,
storageAssetFilter,
} from "../../features/map/layer-style";

export { type RzRegDataCentre } from "../../features/map/contracts";

export function PowerFinderMap({
  collection,
  enabledLayers,
  selectedFeature,
  previewFeature,
  mapMode,
  basemapMode = "dark",
  generationGroup = "all",
  minimumGenerationMw = 0,
  maximumGenerationMw = null,
  minimumStorageMw = 0,
  maximumStorageMw = null,
  isolatedVoltageClass = null,
  scaleMarkersByCapacity = true,
  capacityNodes = [],
  capacityMetric = "firm_import_mw",
  requiredCapacityMw = 1,
  capacityCoverage = null,
  viewportTarget,
  navigationTarget,
  onSelect,
  onViewportChange,
  projectSite,
  onSitePlacement,
  onVisibleLayerCounts,
  discoveryLocations = null,
  onDiscoverySelect,
  showDataCentres = true,
  onDataCentreSelect,
  onBasemapStatusChange,
  onDataSourceStatusChange,
}: PowerFinderMapProps) {
  const resources = useMapResources({
    collection,
    enabledLayers,
    selectedFeature,
    previewFeature,
    mapMode,
    basemapMode,
    generationGroup,
    minimumGenerationMw,
    maximumGenerationMw,
    minimumStorageMw,
    maximumStorageMw,
    isolatedVoltageClass,
    scaleMarkersByCapacity,
    capacityNodes,
    capacityMetric,
    requiredCapacityMw,
    capacityCoverage,
    viewportTarget,
    navigationTarget,
    onSelect,
    onViewportChange,
    projectSite,
    onSitePlacement,
    onVisibleLayerCounts,
    discoveryLocations,
    onDiscoverySelect,
    showDataCentres,
    onDataCentreSelect,
    onBasemapStatusChange,
    onDataSourceStatusChange,
  });
  const {
    containerRef,
    mapRef,
    onSelectRef,
    onViewportChangeRef,
    collectionRef,
    projectSiteRef,
    onSitePlacementRef,
    onVisibleLayerCountsRef,
    onDiscoverySelectRef,
    discoveryLocationsRef,
    onDataCentreSelectRef,
    showDataCentresRef,
    selectedFeatureRef,
    previewFeatureRef,
    capacityNodesRef,
    capacityMetricRef,
    requiredCapacityMwRef,
    capacityCoverageRef,
    basemapModeRef,
    basemapLayerIdsRef,
    basemapFallbackActiveRef,
    onBasemapStatusChangeRef,
    onDataSourceStatusChangeRef,
    runtimeSourceStatusRef,
    enabledLayersRef,
    assetFilterRef,
    isolatedVoltageClassRef,
    scaleMarkersByCapacityRef,
  } = resources;
  useEffect(() => initializeMap(resources), [resources]);

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
  }, [collection, mapRef]);

  useEffect(() => {
    const source = mapRef.current?.getSource(sourceIds.node);
    if (!isGeoJsonSource(source)) return;
    const split = splitMapCollection(
      withCapacityResults(collection, capacityNodes, capacityMetric, requiredCapacityMw),
    );
    source.setData(split.nodes);
  }, [collection, capacityNodes, capacityMetric, requiredCapacityMw, mapRef]);

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
  }, [capacityCoverage, mapMode, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nationalLayers = {
      "national-grid-lines": enabledLayers.line,
      "national-grid-nodes": enabledLayers.node,
      "national-industrial-sites": enabledLayers.industrial_site,
      "national-industrial-overview": enabledLayers.industrial_site,
      "national-generation-overview": enabledLayers.generation_asset,
      "national-generation-overview-label": enabledLayers.generation_asset,
      "national-generation-technology-glyph": enabledLayers.generation_asset,
      "national-generation-assets": enabledLayers.generation_asset,
      "national-generation-asset-labels": enabledLayers.generation_asset,
      "national-storage-assets": enabledLayers.storage_asset,
      "national-storage-technology-icon": enabledLayers.storage_asset,
      "national-storage-asset-labels": enabledLayers.storage_asset,
    } as const;
    for (const [layer, visible] of Object.entries(nationalLayers)) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
    }
    const localLayers = {
      // Registry vector tiles already provide technology-separated regional
      // aggregates and exact assets. Showing the bounded GeoJSON registry
      // copy at the same time creates duplicate, mixed-technology grey
      // clusters over the correctly coloured national symbols.
      "generation-clusters": false,
      "generation-cluster-count": false,
      "generation-assets": false,
      "storage-clusters": false,
      "storage-cluster-count": false,
      "storage-assets": false,
    } as const;
    for (const [layer, visible] of Object.entries(localLayers)) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
    }
    map.once("idle", () => publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current));
  }, [enabledLayers, mapRef, onVisibleLayerCountsRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const voltage = voltageClassFilter(isolatedVoltageClass);
    const nationalLineFilter = voltage
      ? (["all", ["==", ["get", "kind"], "line"], voltage] as ExpressionSpecification)
      : (["==", ["get", "kind"], "line"] as ExpressionSpecification);
    const nationalNodeFilter = voltage
      ? (["all", ["==", ["get", "kind"], "node"], voltage] as ExpressionSpecification)
      : (["==", ["get", "kind"], "node"] as ExpressionSpecification);
    const localNodeFilter = voltage
      ? (["all", ["!", ["has", "point_count"]], voltage] as ExpressionSpecification)
      : (["!", ["has", "point_count"]] as ExpressionSpecification);
    if (map.getLayer("national-grid-lines"))
      map.setFilter("national-grid-lines", nationalLineFilter);
    if (map.getLayer("national-grid-nodes"))
      map.setFilter("national-grid-nodes", nationalNodeFilter);
    if (map.getLayer("grid-lines")) map.setFilter("grid-lines", voltage ?? ["has", "kind"]);
    if (map.getLayer("grid-nodes")) map.setFilter("grid-nodes", localNodeFilter);
    for (const layer of ["node-clusters", "node-cluster-count"]) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", "none");
    }
    map.once("idle", () => publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current));
  }, [isolatedVoltageClass, mapRef, onVisibleLayerCountsRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const layer of [
      "rzreg-data-centre-clusters",
      "rzreg-data-centre-cluster-count",
      "rzreg-data-centres-approximate-area",
      "rzreg-data-centres-approximate",
      "rzreg-data-centres-exact",
    ]) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, "visibility", showDataCentres ? "visible" : "none");
    }
  }, [mapRef, showDataCentres]);

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
    if (projectSite) {
      mapRef.current?.easeTo({
        center: projectSite,
        zoom: Math.max(mapRef.current.getZoom(), 11.2),
        duration: 650,
      });
    }
  }, [mapRef, projectSite]);

  useEffect(() => {
    const source = mapRef.current?.getSource("finder-discovery-locations");
    if (isGeoJsonSource(source)) {
      source.setData(discoveryLocations ?? { type: "FeatureCollection", features: [] });
    }
  }, [discoveryLocations, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("grid-nodes")) return;
    const voltageColour = voltageColorExpression();
    const evidenceColour: ExpressionSpecification = [
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
    const capacityColour: ExpressionSpecification = [
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
    const nationalCapacityColour: ExpressionSpecification = [
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
    const voltageClusterColour: ExpressionSpecification = [
      "step",
      ["get", "point_count"],
      "#f59e0b",
      25,
      "#f97316",
      100,
      "#ef4444",
    ];
    const capacityClusterColour: ExpressionSpecification = [
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
  }, [mapMode, capacityNodes, capacityMetric, requiredCapacityMw, mapRef]);

  useEffect(() => {
    if (!viewportTarget || !mapRef.current) return;
    mapRef.current.flyTo({
      center: viewportTarget.center,
      zoom: viewportTarget.zoom,
      duration: 700,
    });
  }, [mapRef, viewportTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!navigationTarget || !map) return;
    if (navigationTarget.kind === "point") {
      map.flyTo({
        center: navigationTarget.center,
        zoom: Math.max(map.getZoom(), navigationTarget.zoom ?? 11),
        duration: 750,
        essential: true,
      });
      return;
    }
    const [west, south, east, north] = navigationTarget.bounds;
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: { top: 90, right: 110, bottom: 90, left: 110 },
        maxZoom: navigationTarget.maxZoom ?? 9.5,
        duration: 850,
        essential: true,
      },
    );
  }, [mapRef, navigationTarget]);

  useEffect(() => {
    const source = mapRef.current?.getSource("finder-selected-candidate");
    if (!isGeoJsonSource(source)) return;
    const highlighted = previewFeature ?? selectedFeature;
    source.setData({
      type: "FeatureCollection",
      features: highlighted?.geometry.type === "Point" ? [highlighted] : [],
    });
  }, [mapRef, previewFeature, selectedFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemapFallbackActiveRef.current) {
      activateDataOnlyBasemap(map, basemapMode, basemapLayerIdsRef.current);
      return;
    }
    applyBasemapVisibility(map, basemapMode, basemapLayerIdsRef.current);
    applyOverlayTheme(map, basemapMode);
  }, [basemapFallbackActiveRef, basemapLayerIdsRef, basemapMode, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const generationFilter = generationAssetFilter(
      generationGroup,
      minimumGenerationMw,
      maximumGenerationMw,
    );
    const storageFilter = storageAssetFilter(minimumStorageMw, maximumStorageMw);
    for (const layer of [
      "national-generation-overview",
      "national-generation-overview-label",
      "national-generation-technology-glyph",
      "national-generation-assets",
      "national-generation-asset-labels",
    ])
      if (map.getLayer(layer)) map.setFilter(layer, generationFilter);
    for (const layer of [
      "national-storage-assets",
      "national-storage-technology-icon",
      "national-storage-asset-labels",
    ])
      if (map.getLayer(layer)) map.setFilter(layer, storageFilter);
  }, [
    generationGroup,
    mapRef,
    maximumGenerationMw,
    maximumStorageMw,
    minimumGenerationMw,
    minimumStorageMw,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const radius = scaleMarkersByCapacity ? registeredCapacityRadius : 6;
    for (const layer of [
      "national-generation-overview",
      "national-generation-assets",
      "national-storage-assets",
      "generation-assets",
      "storage-assets",
    ]) {
      if (map.getLayer(layer)) map.setPaintProperty(layer, "circle-radius", radius);
    }
  }, [mapRef, scaleMarkersByCapacity]);

  return (
    <div
      ref={containerRef}
      className="power-finder-map"
      role="application"
      aria-label="Interactive grid and industrial-site screening map"
      data-selected-feature={selectedFeature?.id ?? ""}
      data-preview-feature={previewFeature?.id ?? ""}
      data-basemap={basemapMode}
    />
  );
}
