import type { InteractiveLegendSection } from "@/components/product/InteractiveMapLegend";
import { type MapPreset } from "@/features/map/map-filter-state";
import { mapIsolationSearchPatch } from "@/features/map/map-url-state";
import {
  GENERATION_TECHNOLOGY_CLASSES,
  STORAGE_TECHNOLOGY,
  type GenerationTechnologyId,
} from "@/features/map/map-visual-registry";
import { capacityMetricLabels } from "@/features/power-finder/calculated-capacity";
import {
  GRID_VOLTAGE_CLASSES,
  type GridVoltageClassId,
} from "@/features/power-finder/voltage-style";
import { useMemo } from "react";

export function useFinderMapPresentation({
  dispatchMapFilter,
  setMapMode,
  setEnabled,
  setShowDataCentres,
  search,
  mapFilters,
  navigate,
  setInteractionNotice,
  mapMode,
  showDataCentres,
  enabled,
  mapSourceSummary,
  registryAssetsUnavailable,
  visibleLayerCounts,
  isolatedVoltageClass,
  isolatedTechnology,
  updateSearch,
  capacityMetric,
}: Pick<
  import("./controller-contract").FinderControllerContract,
  | "dispatchMapFilter"
  | "setMapMode"
  | "setEnabled"
  | "setShowDataCentres"
  | "search"
  | "mapFilters"
  | "navigate"
  | "setInteractionNotice"
  | "mapMode"
  | "showDataCentres"
  | "enabled"
  | "mapSourceSummary"
  | "registryAssetsUnavailable"
  | "visibleLayerCounts"
  | "isolatedVoltageClass"
  | "isolatedTechnology"
  | "updateSearch"
  | "capacityMetric"
>) {
  const applyMapPreset = (preset: MapPreset) => {
    dispatchMapFilter({ type: "set_preset", preset });
    setMapMode("voltage");
    if (preset === "connection") {
      setEnabled({
        node: true,
        line: true,
        industrial_site: false,
        generation_asset: false,
        storage_asset: false,
      });
      setShowDataCentres(false);
    } else if (preset === "infrastructure") {
      setEnabled({
        node: true,
        line: true,
        industrial_site: false,
        generation_asset: false,
        storage_asset: false,
      });
      setShowDataCentres(false);
    } else {
      setEnabled({
        node: false,
        line: true,
        industrial_site: false,
        generation_asset: true,
        storage_asset: true,
      });
      setShowDataCentres(false);
      if (search.generationMinMw == null) {
        dispatchMapFilter({
          type: "set_generation_range",
          minimum: 10,
          maximum: mapFilters.maximumGenerationMw,
        });
      }
      if (search.storageMinMw == null) {
        dispatchMapFilter({
          type: "set_storage_range",
          minimum: 1,
          maximum: mapFilters.maximumStorageMw,
        });
      }
    }
    void navigate({
      to: "/power-finder",
      search: {
        ...search,
        mapView: preset === "connection" ? undefined : preset,
        mapMode: "voltage",
        isolateVoltage: undefined,
        isolateTechnology: undefined,
        generationMinMw:
          preset === "generation" && search.generationMinMw == null ? 10 : search.generationMinMw,
        storageMinMw:
          preset === "generation" && search.storageMinMw == null ? 1 : search.storageMinMw,
      },
      replace: true,
    });
    setInteractionNotice(`${preset.replaceAll("_", " ")} map view selected.`);
  };

  const legendSections = useMemo(() => {
    if (mapMode === "capacity") return [];
    const sections: InteractiveLegendSection[] = [];
    if (showDataCentres) {
      sections.push({
        id: "data-centres",
        title: "Data centres",
        description:
          "Official German Data Centre Register locations. Markers show published location precision—not grid capacity.",
        items: [
          {
            id: "facility-address",
            label: "Facility address",
            color: "#14b8a6",
            shape: "dot" as const,
            count: 38,
          },
          {
            id: "postcode-area",
            label: "Postcode area",
            color: "#f59e0b",
            shape: "ring" as const,
            count: 281,
          },
        ],
      });
    }
    if (enabled.node || enabled.line) {
      sections.push({
        id: "voltage",
        title: "Voltage",
        description: "Mapped public topology; voltage is not available connection capacity.",
        isolatable: true,
        items: GRID_VOLTAGE_CLASSES.map((item) => ({
          id: item.id,
          label: item.label,
          color: item.color,
          shape: "line" as const,
          unavailable: mapSourceSummary?.voltageCoverage[item.id] === "not_covered",
          unavailableReason:
            item.id === "distribution"
              ? "German distribution topology is incomplete. An empty view is not evidence that no network exists."
              : undefined,
        })),
      });
    }
    if (enabled.industrial_site) {
      sections.push({
        id: "industrial-sites",
        title: "Industrial sites",
        description: "Mapped land context. Select a marker to inspect published site attributes.",
        items: [
          {
            id: "industrial-site",
            label: "Mapped industrial site",
            color: "#67e8f9",
            shape: "ring" as const,
            count: visibleLayerCounts.industrial_site,
          },
        ],
      });
    }
    if (enabled.generation_asset) {
      sections.push({
        id: "generation-technology",
        dimension: "technology",
        title: "Generation",
        description:
          "Marker area represents registered capacity where published—not grid headroom.",
        isolatable: true,
        items: [
          ...GENERATION_TECHNOLOGY_CLASSES.map((item) => ({
            ...item,
            shape: "dot" as const,
            unavailable: registryAssetsUnavailable,
            unavailableReason: registryAssetsUnavailable
              ? "Registry assets are unavailable in the accepted static fallback."
              : undefined,
          })),
        ],
      });
    }
    if (enabled.storage_asset) {
      sections.push({
        id: "storage-technology",
        dimension: "technology",
        title: "Storage",
        description:
          "Marker area represents registered power where published—not available grid capacity.",
        isolatable: true,
        items: [
          {
            ...STORAGE_TECHNOLOGY,
            shape: "ring" as const,
            unavailable: registryAssetsUnavailable,
            unavailableReason: registryAssetsUnavailable
              ? "Registry assets are unavailable in the accepted static fallback."
              : undefined,
          },
        ],
      });
    }
    return sections;
  }, [
    enabled.industrial_site,
    enabled.line,
    enabled.node,
    enabled.generation_asset,
    enabled.storage_asset,
    mapMode,
    registryAssetsUnavailable,
    mapSourceSummary,
    showDataCentres,
    visibleLayerCounts.industrial_site,
  ]);

  const isolateMapLegendItem = (dimension: string, value: string) => {
    if (dimension === "voltage") {
      const next = isolatedVoltageClass === value ? null : (value as GridVoltageClassId);
      dispatchMapFilter(
        next
          ? { type: "isolate", isolation: { dimension: "voltage", value: next } }
          : { type: "clear_isolation" },
      );
      void updateSearch(
        mapIsolationSearchPatch(next ? { dimension: "voltage", value: next } : null),
      );
      setInteractionNotice(
        next
          ? `Showing only ${GRID_VOLTAGE_CLASSES.find((item) => item.id === next)?.label}.`
          : "Voltage isolation cleared.",
      );
      return;
    }
    if (dimension === "technology") {
      const next = isolatedTechnology === value ? null : value;
      dispatchMapFilter(
        next
          ? {
              type: "isolate",
              isolation: {
                dimension: "technology",
                value: next as GenerationTechnologyId | "storage",
              },
            }
          : { type: "clear_isolation" },
      );
      void updateSearch(
        mapIsolationSearchPatch(
          next
            ? {
                dimension: "technology",
                value: next as GenerationTechnologyId | "storage",
              }
            : null,
        ),
      );
      setInteractionNotice(
        next ? `Showing only ${next.replaceAll("_", " ")}.` : "Technology isolation cleared.",
      );
    }
  };

  const activeLegendTitle = useMemo(() => {
    if (mapMode === "capacity") return `${capacityMetricLabels[capacityMetric]} · MW`;
    const labels = [
      showDataCentres ? "Data centres" : null,
      enabled.node ? "Nodes" : null,
      enabled.line ? "Corridors" : null,
      enabled.industrial_site ? "Industrial sites" : null,
      enabled.generation_asset ? "Generation" : null,
      enabled.storage_asset ? "Storage" : null,
    ].filter(Boolean);
    if (labels.length === 0) return "Map legend";
    if (labels.length === 1) return labels[0] as string;
    return `${labels.length} active layers`;
  }, [
    capacityMetric,
    enabled.generation_asset,
    enabled.industrial_site,
    enabled.line,
    enabled.node,
    enabled.storage_asset,
    mapMode,
    showDataCentres,
  ]);
  return { applyMapPreset, legendSections, isolateMapLegendItem, activeLegendTitle };
}
