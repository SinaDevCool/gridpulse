import { opportunityNode } from "./candidate-intelligence";
import { classifyCapacityOpportunity } from "./capacity-opportunity";
import type { FinderControllerContract } from "./controller-contract";
import { canonicalOperatorName } from "./operator-normalization";

export function selectVisibleCollection(
  input: Pick<
    FinderControllerContract,
    | "collection"
    | "query"
    | "minimumVoltage"
    | "operatorCatalog"
    | "selectedTso"
    | "selectedDso"
    | "effectiveGenerationGroup"
    | "minimumGenerationMw"
    | "minimumStorageMw"
    | "mapFilters"
    | "effectiveEnabled"
  >,
) {
  const {
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
  } = input;

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
}

export function selectCandidates(
  input: Pick<
    FinderControllerContract,
    | "query"
    | "ranking"
    | "rankingCollection"
    | "collection"
    | "minimumVoltage"
    | "selectedDso"
    | "selectedTso"
    | "operatorCatalog"
    | "mapMode"
    | "activeCapacityNodes"
    | "capacityMetric"
    | "requiredCapacityMw"
    | "candidateSort"
  >,
) {
  const {
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
  } = input;

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
}
