import { summariseCapacityOpportunities } from "@/features/power-finder/capacity-opportunity";
import { type PowerFinderCollection } from "@/features/power-finder/fixture-data";
import { operatorBoundsIntersect } from "@/features/power-finder/operator-map-navigation";
import { canonicalOperatorName } from "@/features/power-finder/operator-normalization";
import { useMemo } from "react";
import type { CandidateOpportunity } from "./candidate-intelligence";
import { selectCandidates, selectVisibleCollection } from "./finder-selectors";

export function useFinderCandidates({
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
}: Pick<
  import("./controller-contract").FinderControllerContract,
  | "collection"
  | "effectiveEnabled"
  | "effectiveGenerationGroup"
  | "mapFilters"
  | "minimumGenerationMw"
  | "minimumStorageMw"
  | "minimumVoltage"
  | "operatorCatalog"
  | "query"
  | "selectedDso"
  | "selectedTso"
  | "activeCoverage"
  | "capacitySource"
  | "berlinCapacity"
  | "capacityViewport"
  | "candidateSort"
  | "capacityMetric"
  | "mapMode"
  | "ranking"
  | "rankingCollection"
  | "requiredCapacityMw"
  | "showAllCandidates"
  | "selected"
  | "search"
> & { selectedOpportunitySnapshot: CandidateOpportunity | null }) {
  const visibleCollection = useMemo<PowerFinderCollection | null>(
    () =>
      selectVisibleCollection({
        collection,
        query,
        minimumVoltage,
        operatorCatalog,
        selectedTso,
        selectedDso,
        effectiveGenerationGroup,
        minimumGenerationMw,
        minimumStorageMw,
        mapFilters,
        effectiveEnabled,
      }),
    [
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
    ],
  );

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

  const candidateSelection = useMemo(
    () =>
      selectCandidates({
        query,
        ranking,
        rankingCollection,
        collection,
        minimumVoltage,
        selectedDso,
        selectedTso,
        operatorCatalog,
        mapMode,
        activeCapacityNodes,
        capacityMetric,
        requiredCapacityMw,
        candidateSort,
      }),
    [
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
    ],
  );

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
  return {
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
  };
}
