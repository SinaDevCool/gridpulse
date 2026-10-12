import type { ActivationStudyTab } from "@/components/product/ActivationStudyPanel";
import { integratedActivationStudyEnabled, productCapabilities } from "@/config/product-mode";
import { resolveMapSourceSummary, sourceSupportsKind } from "@/features/map/map-source-registry";
import {
  activationStudySnapshot,
  createActivationStudyContext,
} from "@/features/power-finder/activation-study";
import { parseComparison } from "@/features/power-finder/candidate-comparison";
import {
  opportunityNode,
  type CandidateOpportunity,
} from "@/features/power-finder/candidate-intelligence";
import { classifyCapacityOpportunity } from "@/features/power-finder/capacity-opportunity";
import { fallbackCoverage } from "@/features/power-finder/coverage";
import { pointCoordinates } from "@/features/power-finder/fixture-data";
import { savePowerFinderCandidate } from "@/features/power-finder/shortlist";
import { useTheme } from "@/features/theme/use-theme";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { type CandidateSort } from "./page-formatting";
import { useFinderCandidates } from "./use-finder-candidates";
import { useFinderEditing } from "./use-finder-editing";
import { useFinderMapPresentation } from "./use-finder-map-presentation";
import { useFinderPersistence } from "./use-finder-persistence";
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
export function useFinderController(): import("./controller-contract").FinderControllerContract {
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
  const { persistScreening } = useFinderPersistence({
    propertySaveRequest,
    setPropertySaveStatus,
    setInteractionNotice,
    project,
    activeProperty,
    setActiveProperty,
    search,
    updateSearch,
  });
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
  const {
    updateProject,
    updateScenarioNumber,
    invalidateDiscoveryResults,
    minimumGenerationMw,
    minimumStorageMw,
    setMinimumGenerationMw,
    setMaximumGenerationMw,
    setMinimumStorageMw,
    setMaximumStorageMw,
    navigateMapToPoint,
    commitNumber,
  } = useFinderEditing({
    setProject,
    setDiscoveryResults,
    setSelectedDiscoveryId,
    setDiscoveryState,
    dispatchMapFilter,
    mapFilters,
    updateSearch,
    setMapNavigationTarget,
    setNumericDrafts,
    setFieldErrors,
  });
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
  const { applyMapPreset, legendSections, isolateMapLegendItem, activeLegendTitle } =
    useFinderMapPresentation({
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
    });
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

  const {
    visibleCollection,
    operators,
    regionalOperators,
    transmissionOperators,
    distributionOperators,
    activeCapacityNodes,
    candidateSelection,
    candidates,
    visibleCandidates,
    capacitySummary,
    selectedOpportunity,
  } = useFinderCandidates({
    collection,
    effectiveEnabled,
    effectiveGenerationGroup,
    mapFilters,
    minimumGenerationMw,
    minimumStorageMw,
    minimumVoltage,
    operatorCatalog,
    query,
    selectedDso,
    selectedTso,
    activeCoverage,
    capacitySource,
    berlinCapacity,
    capacityViewport,
    candidateSort,
    capacityMetric,
    mapMode,
    ranking,
    rankingCollection,
    requiredCapacityMw,
    showAllCandidates,
    selectedOpportunitySnapshot,
    selected,
    search,
  });
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
