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

function stableCapacitySeed(identifier: string) {
  let value = 2166136261;
  for (const character of identifier) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value >>> 0);
}

export function createIllustrativeCapacityNodes(nodeIds: string[]): CalculatedCapacityNode[] {
  return nodeIds.map((publicNodeId, index) => {
    const seed = stableCapacitySeed(publicNodeId);
    const firm = 8 + (seed % 113);
    const flexible = firm + 4 + ((seed >>> 4) % 28);
    const bess = flexible + 3 + ((seed >>> 9) % 18);
    return {
      resultId: `illustrative-${publicNodeId}`,
      studyRunId: "illustrative-public-demo",
      publicNodeId,
      candidateId: `illustrative-candidate-${index}`,
      modelBusId: `illustrative-bus-${String(index + 1).padStart(3, "0")}`,
      valueMw: firm,
      firmCapacityMw: firm,
      flexibleCapacityMw: flexible,
      bessAssistedCapacityMw: bess,
      stagedInitialCapacityMw: Math.max(4, Math.round(firm * 0.72)),
      eventualCapacityMw: Math.max(flexible, firm + 12 + ((seed >>> 13) % 35)),
      restrictedHours: 40 + (seed % 360),
      restrictedEnergyMwh: 80 + (seed % 920),
      bindingCategory: ["thermal", "voltage", "contingency"][seed % 3],
      validationState: "calculated",
      calculatedAt: "2026-08-09T00:00:00.000Z",
      modelVersion: "illustrative-capacity-demo-v1",
      scenarioLabel: "Illustrative demo — not a network study",
      securityCase: "n_1",
    };
  });
}
