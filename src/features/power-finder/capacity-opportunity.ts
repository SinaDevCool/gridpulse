import {
  capacityValueForMetric,
  type CalculatedCapacityNode,
  type CapacityMetric,
} from "./calculated-capacity";

export type CapacityFit = "meets" | "activation" | "below" | "stale" | "unknown";

export type CapacityOpportunity = {
  fit: CapacityFit;
  valueMw: number | null;
  marginMw: number | null;
  coverageRatio: number | null;
  alternative: "flexible" | "bess" | "staged" | null;
};

export function classifyCapacityOpportunity(
  node: CalculatedCapacityNode | null | undefined,
  metric: CapacityMetric,
  requiredMw: number,
): CapacityOpportunity {
  if (!node || node.validationState === "failed") {
    return {
      fit: "unknown",
      valueMw: null,
      marginMw: null,
      coverageRatio: null,
      alternative: null,
    };
  }
  if (node.validationState === "stale") {
    return { fit: "stale", valueMw: null, marginMw: null, coverageRatio: null, alternative: null };
  }
  const valueMw = capacityValueForMetric(node, metric);
  if (valueMw == null) {
    return {
      fit: "unknown",
      valueMw: null,
      marginMw: null,
      coverageRatio: null,
      alternative: null,
    };
  }
  const base = {
    valueMw,
    marginMw: valueMw - requiredMw,
    coverageRatio: requiredMw > 0 ? valueMw / requiredMw : null,
  };
  if (valueMw >= requiredMw) return { ...base, fit: "meets", alternative: null };

  if (metric === "firm_import_mw" || metric === "n0_import_mw") {
    if ((node.flexibleCapacityMw ?? -Infinity) >= requiredMw) {
      return { ...base, fit: "activation", alternative: "flexible" };
    }
    if ((node.bessAssistedCapacityMw ?? -Infinity) >= requiredMw) {
      return { ...base, fit: "activation", alternative: "bess" };
    }
    if ((node.eventualCapacityMw ?? -Infinity) >= requiredMw) {
      return { ...base, fit: "activation", alternative: "staged" };
    }
  }
  return { ...base, fit: "below", alternative: null };
}

export function summariseCapacityOpportunities(
  nodes: CalculatedCapacityNode[],
  metric: CapacityMetric,
  requiredMw: number,
  mappedCount: number,
) {
  const counts = { meets: 0, activation: 0, below: 0, stale: 0, unknown: 0 };
  for (const node of nodes) counts[classifyCapacityOpportunity(node, metric, requiredMw).fit] += 1;
  counts.unknown += Math.max(0, mappedCount - nodes.length);
  return counts;
}
