import type { ActivationStudyTab } from "@/components/product/ActivationStudyPanel";
import type { InteractiveLegendSection } from "@/components/product/InteractiveMapLegend";
import { integratedActivationStudyEnabled,productCapabilities } from "@/config/product-mode";
import { getAnonymousProperty } from "@/features/anonymous-workspace/repository";
import { type MapPreset } from "@/features/map/map-filter-state";
import { resolveMapSourceSummary,sourceSupportsKind } from "@/features/map/map-source-registry";
import { mapIsolationSearchPatch } from "@/features/map/map-url-state";
import {
GENERATION_TECHNOLOGY_CLASSES,
STORAGE_TECHNOLOGY,
type GenerationTechnologyId,
} from "@/features/map/map-visual-registry";
import {
activationStudySnapshot,
createActivationStudyContext,
} from "@/features/power-finder/activation-study";
import { capacityMetricLabels } from "@/features/power-finder/calculated-capacity";
import { parseComparison } from "@/features/power-finder/candidate-comparison";
import {
opportunityNode,
type CandidateOpportunity,
} from "@/features/power-finder/candidate-intelligence";
import {
classifyCapacityOpportunity,
summariseCapacityOpportunities,
} from "@/features/power-finder/capacity-opportunity";
import { fallbackCoverage } from "@/features/power-finder/coverage";
import { type FinderProject } from "@/features/power-finder/finder-project";
import { pointCoordinates,type PowerFinderCollection } from "@/features/power-finder/fixture-data";
import { operatorBoundsIntersect } from "@/features/power-finder/operator-map-navigation";
import { canonicalOperatorName } from "@/features/power-finder/operator-normalization";
import {
validateFinderNumber,
type FinderNumericField,
} from "@/features/power-finder/project-validation";
import { saveFinderProjectToPortfolio } from "@/features/power-finder/property-handoff";
import { savePowerFinderCandidate } from "@/features/power-finder/shortlist";
import {
GRID_VOLTAGE_CLASSES,
type GridVoltageClassId,
} from "@/features/power-finder/voltage-style";
import { useTheme } from "@/features/theme/use-theme";
import { useNavigate,useSearch } from "@tanstack/react-router";
import { useMemo,type ChangeEvent } from "react";
import { withTimeout,type CandidateSort } from './page-formatting';
import { useFinderCapacityEffects } from "./useFinderCapacityEffects";
import { useFinderCapacityState } from "./useFinderCapacityState";
import { useFinderDataEffects } from "./useFinderDataEffects";
import { useFinderDataState } from "./useFinderDataState";
import { useFinderDiscoveryState } from "./useFinderDiscoveryState";
import { useFinderInteractionState } from "./useFinderInteractionState";
import { useFinderMapEffects } from "./useFinderMapEffects";
import { useFinderMapState } from "./useFinderMapState";
import { useFinderOperatorEffects } from "./useFinderOperatorEffects";
import { useFinderProjectEffects } from "./useFinderProjectEffects";
import { useFinderProjectState } from "./useFinderProjectState";
import { useFinderSelectionEffects } from "./useFinderSelectionEffects";
import { useFinderStudyEffects } from "./useFinderStudyEffects";
export function useFinderController() {
  const { resolved: basemapMode } = useTheme();
  const navigate = useNavigate({ from: "/power-finder" });
  const search = useSearch({ from: "/power-finder" });
  const {
    project,
    setProject,
    projectHydrated,
    setProjectHydrated,
    saveStatus,
    setSaveStatus,
    shortlistId,
    setShortlistId,
    propertySaveStatus,
    setPropertySaveStatus,
    activeProperty,
    setActiveProperty,
    propertySaveRequest,
  } = useFinderProjectState(search);
  const {
    collection,
    setCollection,
    error,
    setError,
    dataMode,
    setDataMode,
    runtimeSourceStatus,
    setRuntimeSourceStatus,
    operatorEvidence,
    setOperatorEvidence,
    operatorEvidenceState,
    setOperatorEvidenceState,
    c1Study,
    setC1Study,
    ranking,
    setRanking,
    rankingCollection,
    setRankingCollection,
    rankingState,
    setRankingState,
    coverage,
    setCoverage,
    operatorCatalog,
    setOperatorCatalog,
    operatorCatalogState,
    setOperatorCatalogState,
  } = useFinderDataState(search);
  const {
    enabled,
    setEnabled,
    bounds,
    setBounds,
    visibleLayerCounts,
    setVisibleLayerCounts,
    showDataCentres,
    setShowDataCentres,
    selectedDataCentre,
    setSelectedDataCentre,
    generationGroup,
    setGenerationGroup,
    mapFilters,
    dispatchMapFilter,
    layersMenuOpen,
    setLayersMenuOpen,
    basemapStatus,
    setBasemapStatus,
    mapRetryKey,
    setMapRetryKey,
    mapNavigationTarget,
    setMapNavigationTarget,
  } = useFinderMapState(search);
  const {
    finderWorkflow,
    setFinderWorkflow,
    discoveryStrategy,
    setDiscoveryStrategy,
    discoveryResultCount,
    setDiscoveryResultCount,
    discoveryResults,
    setDiscoveryResults,
    selectedDiscoveryId,
    setSelectedDiscoveryId,
    discoveryState,
    setDiscoveryState,
  } = useFinderDiscoveryState(search);
  const {
    mapMode,
    setMapMode,
    capacityMetric,
    setCapacityMetric,
    requiredCapacityMw,
    setRequiredCapacityMw,
    capacitySource,
    setCapacitySource,
    capacityViewport,
    setCapacityViewport,
    berlinCapacity,
    setBerlinCapacity,
    capacityState,
    setCapacityState,
  } = useFinderCapacityState(search, project);
  const {
    selected,
    setSelected,
    selectedOpportunitySnapshot,
    setSelectedOpportunitySnapshot,
    detailPanelRef,
    detailReturnFocusRef,
    showAllCandidates,
    setShowAllCandidates,
    numericDrafts,
    setNumericDrafts,
    fieldErrors,
    setFieldErrors,
    interactionNotice,
    setInteractionNotice,
    previewCandidateId,
    setPreviewCandidateId,
    comparisonOpen,
    setComparisonOpen,
    projectEditorOpen,
    setProjectEditorOpen,
    secondaryControlsOpen,
    setSecondaryControlsOpen,
    sidebarOpen,
    setSidebarOpen,
    legendOpen,
    setLegendOpen,
    detailDismissedRef,
  } = useFinderInteractionState(search, project);
  const query = search.q ?? "";
  const minimumVoltage = search.voltage ?? (project.importMw >= 100 ? 110 : 0);
  const legacyOperator = search.operator ?? "all";
  const selectedTso = search.tso ?? "all";
  const selectedDso = search.dso ?? "all";
  const candidateSort: CandidateSort = search.sort ?? "context";
  const requiredImportMw = project.importMw;
  const maxDistanceKm = project.maxDistanceKm;
  const updateSearch = (patch: Partial<typeof search>) =>
    navigate({
      to: "/power-finder",
      search: (current) => ({ ...current, ...patch }),
      replace: true,
    });
  const persistScreening = async (
    candidatesToSave: CandidateOpportunity[],
    shortlistedCandidateId: string | null = null,
  ) => {
    const requestId = ++propertySaveRequest.current;
    setPropertySaveStatus("saving");
    setInteractionNotice(
      shortlistedCandidateId ? "Saving shortlisted candidate…" : "Saving screening…",
    );
    try {
      const savedPropertyId = await withTimeout(
        saveFinderProjectToPortfolio(
          project,
          candidatesToSave,
          activeProperty?.id,
          shortlistedCandidateId,
        ),
        10_000,
        "Saving took too long. Please try again.",
      );
      if (requestId !== propertySaveRequest.current) return null;
      const refreshed = await withTimeout(
        getAnonymousProperty(savedPropertyId),
        5_000,
        "The site was saved, but could not be reloaded.",
      );
      if (requestId !== propertySaveRequest.current) return null;
      setActiveProperty(refreshed);
      setPropertySaveStatus("saved");
      setInteractionNotice(
        shortlistedCandidateId
          ? "Candidate shortlisted and saved to the site workspace."
          : "Screening saved to the site workspace.",
      );
      if (search.propertyId !== savedPropertyId) void updateSearch({ propertyId: savedPropertyId });
      return savedPropertyId;
    } catch (reason) {
      if (requestId !== propertySaveRequest.current) return null;
      setPropertySaveStatus("error");
      setInteractionNotice(
        reason instanceof Error ? reason.message : "The screening could not be saved.",
      );
      return null;
    }
  };
  const updateProject = (patch: Partial<FinderProject>) => {
    setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  };
  const updateScenarioNumber =
    (
      field:
        | "ultimateImportMw"
        | "minimumFirmMw"
        | "flexibleLoadMw"
        | "targetEnergisationYear"
        | "annualConsumptionGwh"
        | "maxInterruptionHours"
        | "annualInterruptionLimit"
        | "batteryRoundTripEfficiencyPct"
        | "batteryReservePct"
        | "onsiteGenerationMw",
      minimum: number,
      maximum: number,
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value))
        updateProject({ [field]: Math.min(maximum, Math.max(minimum, value)) });
    };
  const invalidateDiscoveryResults = () => {
    setDiscoveryResults([]);
    setSelectedDiscoveryId(null);
    setDiscoveryState("idle");
  };
  const minimumGenerationMw = mapFilters.minimumGenerationMw;
  const minimumStorageMw = mapFilters.minimumStorageMw;
  const setMinimumGenerationMw = (minimum: number) => {
    dispatchMapFilter({
      type: "set_generation_range",
      minimum,
      maximum: mapFilters.maximumGenerationMw,
    });
    void updateSearch({ generationMinMw: minimum || undefined });
  };
  const setMaximumGenerationMw = (maximum: number | null) => {
    dispatchMapFilter({
      type: "set_generation_range",
      minimum: mapFilters.minimumGenerationMw,
      maximum,
    });
    void updateSearch({ generationMaxMw: maximum ?? undefined });
  };
  const setMinimumStorageMw = (minimum: number) => {
    dispatchMapFilter({
      type: "set_storage_range",
      minimum,
      maximum: mapFilters.maximumStorageMw,
    });
    void updateSearch({ storageMinMw: minimum || undefined });
  };
  const setMaximumStorageMw = (maximum: number | null) => {
    dispatchMapFilter({
      type: "set_storage_range",
      minimum: mapFilters.minimumStorageMw,
      maximum,
    });
    void updateSearch({ storageMaxMw: maximum ?? undefined });
  };
  const navigateMapToPoint = (center: [number, number]) =>
    setMapNavigationTarget({ requestId: Date.now(), kind: "point", center, zoom: 11 });
  const navigateMapToOperator = (operatorName: string) => {
    if (operatorName === "all") return;
    const selectedOperator = operators.find((item) => item.name === operatorName);
    if (!selectedOperator?.bounds) {
      setInteractionNotice(
        `${operatorName} was selected, but its mapped geographic extent is not available yet.`,
      );
      return;
    }
    setMapNavigationTarget({
      requestId: Date.now(),
      kind: "bounds",
      bounds: selectedOperator.bounds,
      maxZoom: selectedOperator.type === "TSO" ? 7.5 : 10,
    });
    setInteractionNotice(
      `Map fitted to the mapped ${selectedOperator.type} extent for ${operatorName}.`,
    );
  };
  const commitNumber = (
    field: FinderNumericField,
    raw: string,
    commit: (value: number | null) => void,
    optional = false,
  ) => {
    setNumericDrafts((current) => ({ ...current, [field]: raw }));
    if (optional && !raw.trim()) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
      commit(null);
      return;
    }
    const result = validateFinderNumber(field, raw);
    setFieldErrors((current) => ({ ...current, [field]: result.error ?? undefined }));
    if (!result.error) commit(result.value);
  };
  const regionCode = search.region ?? "DE";
  const mapSourceSummary = collection
    ? resolveMapSourceSummary(collection, runtimeSourceStatus)
    : null;
  const registryAssetsUnavailable = mapSourceSummary
    ? !sourceSupportsKind(mapSourceSummary, "generation_asset") &&
      runtimeSourceStatus.registry !== "ready"
    : true;
  const isolatedVoltageClass =
    mapFilters.isolation?.dimension === "voltage" ? mapFilters.isolation.value : null;
  const isolatedTechnology =
    mapFilters.isolation?.dimension === "technology" ? mapFilters.isolation.value : null;
  const effectiveGenerationGroup =
    isolatedTechnology && isolatedTechnology !== "storage" ? isolatedTechnology : generationGroup;
  const effectiveEnabled = useMemo(
    () => ({
      ...enabled,
      generation_asset: isolatedTechnology === "storage" ? false : enabled.generation_asset,
      storage_asset:
        isolatedTechnology && isolatedTechnology !== "storage" ? false : enabled.storage_asset,
    }),
    [enabled, isolatedTechnology],
  );
  useFinderMapEffects({
    enabled,
    updateSearch,
    dispatchMapFilter,
    basemapStatus,
    setBasemapStatus,
    mapRetryKey,
    isolatedTechnology,
  });
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
  const activeCoverage =
    coverage.find((item) => item.regionCode === regionCode) ?? fallbackCoverage[1];
  const viewportTarget = useMemo(
    () => ({ center: activeCoverage.center, zoom: activeCoverage.zoom }),
    [activeCoverage.center, activeCoverage.zoom],
  );
  const projectSite = useMemo<[number, number] | null>(
    () =>
      project.longitude != null && project.latitude != null
        ? [project.longitude, project.latitude]
        : null,
    [project.latitude, project.longitude],
  );

  useFinderCapacityEffects({
    search,
    collection,
    project,
    mapMode,
    setMapMode,
    capacityMetric,
    setCapacityMetric,
    setRequiredCapacityMw,
    capacitySource,
    setCapacitySource,
    setCapacityViewport,
    setBerlinCapacity,
    setCapacityState,
  });

  useFinderProjectEffects({
    navigate,
    search,
    project,
    setProject,
    projectHydrated,
    setProjectHydrated,
    maxDistanceKm,
    setActiveProperty,
    updateSearch,
    setInteractionNotice,
    setSecondaryControlsOpen,
  });

  useFinderDataEffects({
    collection,
    setCollection,
    project,
    setError,
    bounds,
    setDataMode,
    maxDistanceKm,
    setRanking,
    setRankingCollection,
    setRankingState,
    setCoverage,
    setOperatorCatalog,
    setOperatorCatalogState,
    regionCode,
  });

  const visibleCollection = useMemo<PowerFinderCollection | null>(() => {
    if (!collection) return null;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const features = collection.features.filter((feature) => {
      const properties = feature.properties;
      const voltage = Math.max(0, ...(properties.voltage_kv ?? []));
      const matchesQuery =
        !normalizedQuery ||
        properties.name.toLocaleLowerCase().includes(normalizedQuery) ||
        properties.operator?.toLocaleLowerCase().includes(normalizedQuery) ||
        feature.id.toLocaleLowerCase().includes(normalizedQuery);
      const matchesVoltage =
        properties.kind !== "node" || minimumVoltage === 0 || voltage >= minimumVoltage;
      const canonicalOperator = canonicalOperatorName(properties.operator);
      const operatorContext = operatorCatalog.find((item) => item.name === canonicalOperator);
      const matchesTso =
        selectedTso === "all" ||
        canonicalOperator === selectedTso ||
        operatorContext?.tsoNames.includes(selectedTso);
      const matchesDso = selectedDso === "all" || canonicalOperator === selectedDso;
      const matchesOperator = matchesTso && matchesDso;
      const matchesRegisteredCapacity =
        properties.kind === "generation_asset"
          ? (effectiveGenerationGroup === "all" ||
              properties.generation_group === effectiveGenerationGroup) &&
            (minimumGenerationMw === 0 ||
              (properties.net_capacity_mw ?? -1) >= minimumGenerationMw) &&
            (mapFilters.maximumGenerationMw === null ||
              (properties.net_capacity_mw ?? mapFilters.maximumGenerationMw + 1) <=
                mapFilters.maximumGenerationMw)
          : properties.kind === "storage_asset"
            ? (minimumStorageMw === 0 || (properties.net_capacity_mw ?? -1) >= minimumStorageMw) &&
              (mapFilters.maximumStorageMw === null ||
                (properties.net_capacity_mw ?? mapFilters.maximumStorageMw + 1) <=
                  mapFilters.maximumStorageMw)
            : true;
      return (
        effectiveEnabled[properties.kind] &&
        matchesQuery &&
        matchesVoltage &&
        matchesOperator &&
        matchesRegisteredCapacity
      );
    });
    return {
      ...collection,
      features,
      metadata: { ...collection.metadata, record_count: features.length },
    };
  }, [
    collection,
    effectiveEnabled,
    effectiveGenerationGroup,
    mapFilters.maximumGenerationMw,
    mapFilters.maximumStorageMw,
    minimumGenerationMw,
    minimumStorageMw,
    minimumVoltage,
    operatorCatalog,
    query,
    selectedDso,
    selectedTso,
  ]);

  const operators = useMemo(() => {
    if (operatorCatalog.length) return operatorCatalog;
    return Array.from(
      new Set(
        collection?.features
          .map((feature) => canonicalOperatorName(feature.properties.operator))
          .filter((value): value is string => Boolean(value)) ?? [],
      ),
    )
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({
        name,
        type: "DSO / other" as const,
        featureCount: 0,
        bounds: null,
        tsoNames: [],
        relationshipBasis: null,
      }));
  }, [collection, operatorCatalog]);
  const regionalOperators = useMemo(
    () =>
      operators.filter(
        (item) => !item.bounds || operatorBoundsIntersect(item.bounds, activeCoverage.bounds),
      ),
    [activeCoverage.bounds, operators],
  );
  const transmissionOperators = useMemo(
    () => regionalOperators.filter((item) => item.type === "TSO"),
    [regionalOperators],
  );
  const distributionOperators = useMemo(() => {
    const regional = regionalOperators.filter((item) => item.type === "DSO / other");
    return selectedTso !== "all"
      ? regional.filter((item) => item.tsoNames.includes(selectedTso))
      : regional;
  }, [regionalOperators, selectedTso]);

  const activeCapacityNodes = useMemo(
    () =>
      capacitySource === "berlin_synthetic"
        ? (berlinCapacity?.results ?? [])
        : (capacityViewport?.nodes ?? []),
    [berlinCapacity?.results, capacitySource, capacityViewport?.nodes],
  );

  const candidateSelection = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const eligibleItems = (ranking?.candidates ?? []).filter((candidate) => {
      const node =
        opportunityNode(candidate, rankingCollection) ?? opportunityNode(candidate, collection);
      const maximumVoltage = Math.max(0, ...candidate.voltageKv);
      const matchesQuery =
        !normalizedQuery ||
        candidate.siteName.toLocaleLowerCase().includes(normalizedQuery) ||
        candidate.nodeName.toLocaleLowerCase().includes(normalizedQuery) ||
        candidate.operator?.toLocaleLowerCase().includes(normalizedQuery);
      const matchesVoltage = minimumVoltage === 0 || maximumVoltage >= minimumVoltage;
      return matchesQuery && matchesVoltage && Boolean(node);
    });
    const dsoItems =
      selectedDso === "all"
        ? eligibleItems
        : eligibleItems.filter(
            (candidate) => canonicalOperatorName(candidate.operator) === selectedDso,
          );
    const dsoFallback = false;
    const baseItems = dsoItems;
    const tsoItems =
      selectedTso === "all"
        ? baseItems
        : baseItems.filter((candidate) => {
            const canonicalCandidateOperator = canonicalOperatorName(candidate.operator);
            const operatorContext = operatorCatalog.find(
              (item) => item.name === canonicalCandidateOperator,
            );
            return (
              canonicalCandidateOperator === selectedTso ||
              operatorContext?.tsoNames.includes(selectedTso)
            );
          });
    const tsoFallback = false;
    const items = tsoItems;
    items.sort((left, right) => {
      if (mapMode === "capacity") {
        const byNode = new Map(activeCapacityNodes.map((node) => [node.publicNodeId, node]));
        const order = { meets: 0, activation: 1, below: 2, stale: 3, unknown: 4 } as const;
        const leftFit = classifyCapacityOpportunity(
          byNode.get(left.nodeId),
          capacityMetric,
          requiredCapacityMw,
        );
        const rightFit = classifyCapacityOpportunity(
          byNode.get(right.nodeId),
          capacityMetric,
          requiredCapacityMw,
        );
        const fitDifference = order[leftFit.fit] - order[rightFit.fit];
        if (fitDifference) return fitDifference;
        const marginDifference = (rightFit.marginMw ?? -Infinity) - (leftFit.marginMw ?? -Infinity);
        if (marginDifference) return marginDifference;
      }
      if (candidateSort === "name") {
        return (
          left.siteName.localeCompare(right.siteName) || left.nodeName.localeCompare(right.nodeName)
        );
      }
      if (candidateSort === "voltage") {
        return Math.max(0, ...right.voltageKv) - Math.max(0, ...left.voltageKv);
      }
      return right.screeningRank - left.screeningRank;
    });
    return { items, tsoFallback, dsoFallback };
  }, [
    candidateSort,
    capacityMetric,
    activeCapacityNodes,
    collection,
    mapMode,
    minimumVoltage,
    operatorCatalog,
    query,
    ranking,
    rankingCollection,
    requiredCapacityMw,
    selectedDso,
    selectedTso,
  ]);
  const candidates = candidateSelection.items;
  const visibleCandidates = showAllCandidates ? candidates : candidates.slice(0, 5);
  const capacitySummary = useMemo(
    () =>
      summariseCapacityOpportunities(
        activeCapacityNodes,
        capacityMetric,
        requiredCapacityMw,
        collection?.features.filter((feature) => feature.properties.kind === "node").length ?? 0,
      ),
    [activeCapacityNodes, capacityMetric, collection, requiredCapacityMw],
  );
  const selectedOpportunity =
    (selectedOpportunitySnapshot?.nodeId === String(selected?.id)
      ? selectedOpportunitySnapshot
      : null) ?? candidates.find((candidate) => candidate.id === search.candidate);

  useFinderOperatorEffects({
    search,
    legacyOperator,
    selectedTso,
    selectedDso,
    updateSearch,
    setInteractionNotice,
    navigateMapToOperator,
    ranking,
    operatorCatalog,
    operators,
    transmissionOperators,
    distributionOperators,
    candidates,
  });
  // URL search is the durable selection source. A viewport refresh can replace the
  // feature collection between a card click and navigation completion, so rebuild
  // the detail feature from the selected opportunity instead of briefly closing it.
  const selectedDetailFeature =
    selected ??
    (selectedOpportunity
      ? (opportunityNode(selectedOpportunity, rankingCollection) ??
        opportunityNode(selectedOpportunity, collection) ?? {
          type: "Feature" as const,
          id: selectedOpportunity.nodeId,
          geometry: {
            type: "Point" as const,
            // This fallback is detail-only. The node's mapped position remains represented
            // by the ranked pathway distance and is never replaced with a capacity claim.
            coordinates: [project.longitude ?? 0, project.latitude ?? 0],
          },
          properties: {
            kind: "node" as const,
            name: selectedOpportunity.nodeName,
            operator: selectedOpportunity.operator ?? undefined,
            voltage_kv: selectedOpportunity.voltageKv,
            max_voltage_kv: Math.max(0, ...selectedOpportunity.voltageKv),
            evidence_class: "open_mapping" as const,
            capacity_state: "not_established" as const,
            source_published_at: selectedOpportunity.sourcePublishedAt ?? undefined,
          },
        })
      : null);
  const closeDetail = async () => {
    detailDismissedRef.current = true;
    await updateSearch({ candidate: undefined });
    setSelectedOpportunitySnapshot(null);
    setSelected(null);
    detailReturnFocusRef.current?.focus();
  };

  const selectedCapacity = selectedDetailFeature
    ? (activeCapacityNodes.find(
        (result) => result.publicNodeId === String(selectedDetailFeature.id),
      ) ?? null)
    : null;
  const selectedCapacityOpportunity = classifyCapacityOpportunity(
    selectedCapacity,
    capacityMetric,
    requiredCapacityMw,
  );
  const selectedNodePathways = selected
    ? candidates.filter((candidate) => candidate.nodeId === String(selected.id))
    : [];
  const previewOpportunity =
    candidates.find((candidate) => candidate.id === previewCandidateId) ?? null;
  const previewFeature = previewOpportunity
    ? (opportunityNode(previewOpportunity, rankingCollection) ??
      opportunityNode(previewOpportunity, collection))
    : null;
  const comparisonIds = useMemo(() => parseComparison(search.compare), [search.compare]);
  const comparedCandidates = useMemo(
    () =>
      comparisonIds
        .map(
          (id) =>
            candidates.find((candidate) => candidate.id === id) ??
            (selectedOpportunitySnapshot?.id === id ? selectedOpportunitySnapshot : undefined),
        )
        .filter((candidate): candidate is CandidateOpportunity => Boolean(candidate)),
    [candidates, comparisonIds, selectedOpportunitySnapshot],
  );
  const comparedActivation = useMemo(
    () =>
      new Map(
        comparedCandidates.map((candidate) => [
          candidate.id,
          createActivationStudyContext({ project, candidate, registeredStudy: null }),
        ]),
      ),
    [comparedCandidates, project],
  );
  const coordinates = selected ? pointCoordinates(selected) : null;
  const activationOpen =
    productCapabilities.workspace &&
    integratedActivationStudyEnabled &&
    search.study === "activation" &&
    Boolean(selectedOpportunity);
  const activationTab: ActivationStudyTab =
    search.studyTab === "geographic" ? "overview" : (search.studyTab ?? "overview");
  const startPrivateAssessment = async (studyInput?: {
    selectedOptionKind: string | null;
    commercialAssumptions: import("@/features/power-finder/activation-study").RepresentativeCommercialAssumptions;
  }) => {
    if (!selected || !coordinates) return;
    setSaveStatus("saving");
    try {
      const activation = selectedOpportunity
        ? activationStudySnapshot(
            createActivationStudyContext({
              project,
              candidate: selectedOpportunity,
              registeredStudy: c1Study,
            }),
            studyInput,
          )
        : null;
      const id = await savePowerFinderCandidate(
        selected,
        selectedOpportunity,
        requiredImportMw,
        activation,
      );
      setShortlistId(id);
      setSaveStatus("saved");
      await navigate({
        to: "/assessments/new",
        search: {
          shortlistId: id,
          name: selectedOpportunity?.siteName ?? selected.properties.name,
          projectType: "large_load",
          importMw: requiredImportMw,
          latitude: coordinates[1],
          longitude: coordinates[0],
          federalState: "Brandenburg",
          challenge: selectedOpportunity
            ? `${selectedOpportunity.siteName} screened against ${selectedOpportunity.nodeName}. The saved Activation Study is a representative benchmark only; capacity, feasibility, cost and timing require operator confirmation.`
            : `Screening candidate ${selected.id}; capacity and operator responsibility require confirmation.`,
        },
      });
    } catch {
      setSaveStatus("error");
    }
  };

  useFinderStudyEffects({
    project,
    selected,
    setSelected,
    setSelectedOpportunitySnapshot,
    dataMode,
    requiredImportMw,
    maxDistanceKm,
    setSaveStatus,
    setShortlistId,
    setOperatorEvidence,
    setOperatorEvidenceState,
    setC1Study,
    setRanking,
    rankingCollection,
    setRankingState,
    candidates,
  });

  useFinderSelectionEffects({
    search,
    collection,
    selected,
    setSelected,
    detailPanelRef,
    updateSearch,
    setInteractionNotice,
    detailDismissedRef,
    rankingCollection,
    candidates,
    selectedOpportunity,
    selectedDetailFeature,
    closeDetail,
  });
  return {
    basemapMode,
    navigate,
    search,
    collection,
    project,
    setProject,
    selected,
    setSelected,
    setSelectedOpportunitySnapshot,
    enabled,
    setEnabled,
    error,
    bounds,
    setBounds,
    dataMode,
    runtimeSourceStatus,
    setRuntimeSourceStatus,
    query,
    minimumVoltage,
    selectedTso,
    selectedDso,
    candidateSort,
    requiredImportMw,
    maxDistanceKm,
    saveStatus,
    setSaveStatus,
    shortlistId,
    setShortlistId,
    propertySaveStatus,
    setPropertySaveStatus,
    activeProperty,
    setActiveProperty,
    propertySaveRequest,
    detailPanelRef,
    detailReturnFocusRef,
    showAllCandidates,
    setShowAllCandidates,
    operatorEvidence,
    operatorEvidenceState,
    c1Study,
    updateSearch,
    persistScreening,
    updateProject,
    updateScenarioNumber,
    numericDrafts,
    setNumericDrafts,
    fieldErrors,
    setFieldErrors,
    interactionNotice,
    setInteractionNotice,
    setPreviewCandidateId,
    visibleLayerCounts,
    setVisibleLayerCounts,
    comparisonOpen,
    setComparisonOpen,
    projectEditorOpen,
    setProjectEditorOpen,
    secondaryControlsOpen,
    setSecondaryControlsOpen,
    sidebarOpen,
    setSidebarOpen,
    legendOpen,
    setLegendOpen,
    showDataCentres,
    setShowDataCentres,
    selectedDataCentre,
    setSelectedDataCentre,
    finderWorkflow,
    setFinderWorkflow,
    discoveryStrategy,
    setDiscoveryStrategy,
    discoveryResultCount,
    setDiscoveryResultCount,
    discoveryResults,
    setDiscoveryResults,
    selectedDiscoveryId,
    setSelectedDiscoveryId,
    discoveryState,
    setDiscoveryState,
    invalidateDiscoveryResults,
    generationGroup,
    setGenerationGroup,
    mapFilters,
    dispatchMapFilter,
    layersMenuOpen,
    setLayersMenuOpen,
    minimumGenerationMw,
    minimumStorageMw,
    setMinimumGenerationMw,
    setMaximumGenerationMw,
    setMinimumStorageMw,
    setMaximumStorageMw,
    basemapStatus,
    setBasemapStatus,
    mapRetryKey,
    setMapRetryKey,
    mapNavigationTarget,
    setMapNavigationTarget,
    navigateMapToPoint,
    commitNumber,
    ranking,
    rankingCollection,
    rankingState,
    coverage,
    operatorCatalog,
    operatorCatalogState,
    regionCode,
    mapMode,
    setMapMode,
    capacityMetric,
    setCapacityMetric,
    requiredCapacityMw,
    setRequiredCapacityMw,
    capacitySource,
    setCapacitySource,
    capacityViewport,
    berlinCapacity,
    capacityState,
    mapSourceSummary,
    registryAssetsUnavailable,
    isolatedVoltageClass,
    effectiveGenerationGroup,
    effectiveEnabled,
    applyMapPreset,
    legendSections,
    isolateMapLegendItem,
    activeLegendTitle,
    activeCoverage,
    viewportTarget,
    projectSite,
    visibleCollection,
    transmissionOperators,
    distributionOperators,
    activeCapacityNodes,
    candidateSelection,
    candidates,
    visibleCandidates,
    capacitySummary,
    selectedOpportunity,
    selectedDetailFeature,
    closeDetail,
    selectedCapacity,
    selectedCapacityOpportunity,
    selectedNodePathways,
    previewFeature,
    comparisonIds,
    comparedCandidates,
    comparedActivation,
    coordinates,
    activationOpen,
    activationTab,
    startPrivateAssessment,
    isolatedTechnology,
    setCollection,
    setError,
    setDataMode,
    setRanking,
    setRankingCollection,
    setRankingState,
    setCoverage,
    setOperatorCatalog,
    setOperatorCatalogState,
    setCapacityViewport,
    setBerlinCapacity,
    setCapacityState,
    projectHydrated,
    setProjectHydrated,
    legacyOperator,
    navigateMapToOperator,
    operators,
    detailDismissedRef,
    setOperatorEvidence,
    setOperatorEvidenceState,
    setC1Study,
  };
}
