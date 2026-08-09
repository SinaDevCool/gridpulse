import { supabase } from "../../integrations/supabase/client";

export type CapacityMetric =
  | "firm_import_mw"
  | "flexible_import_mw"
  | "bess_assisted_import_mw"
  | "staged_initial_import_mw"
  | "eventual_import_mw";

export type CapacityValidationState =
  | "calculated"
  | "operator_reviewed"
  | "operator_confirmed"
  | "stale"
  | "failed";

export type CalculatedCapacityNode = {
  resultId: string;
  studyRunId: string;
  publicNodeId: string;
  candidateId: string;
  modelBusId: string;
  valueMw: number | null;
  firmCapacityMw: number | null;
  flexibleCapacityMw: number | null;
  bessAssistedCapacityMw: number | null;
  stagedInitialCapacityMw: number | null;
  eventualCapacityMw: number | null;
  restrictedHours: number | null;
  restrictedEnergyMwh: number | null;
  bindingCategory: string | null;
  validationState: CapacityValidationState;
  calculatedAt: string;
  modelVersion: string;
  scenarioLabel: string;
  securityCase: "n_0" | "n_1";
};

export type CapacityCoverage = {
  mapped: number;
  calculated: number;
  reviewed: number;
  stale: number;
  unknown: number;
};

export type CalculatedCapacityViewport = {
  metric: CapacityMetric;
  coverage: CapacityCoverage;
  nodes: CalculatedCapacityNode[];
  access: "ready" | "sign_in_required" | "workspace_required" | "unavailable";
  evidenceBoundary: string;
};

export const capacityMetricLabels: Record<CapacityMetric, string> = {
  firm_import_mw: "Firm import",
  flexible_import_mw: "Flexible import",
  bess_assisted_import_mw: "BESS-assisted import",
  staged_initial_import_mw: "Staged initial import",
  eventual_import_mw: "Eventual import",
};

export function capacityValueForMetric(
  node: Omit<CalculatedCapacityNode, "valueMw">,
  metric: CapacityMetric,
) {
  return {
    firm_import_mw: node.firmCapacityMw,
    flexible_import_mw: node.flexibleCapacityMw,
    bess_assisted_import_mw: node.bessAssistedCapacityMw,
    staged_initial_import_mw: node.stagedInitialCapacityMw,
    eventual_import_mw: node.eventualCapacityMw,
  }[metric];
}

const emptyViewport = (metric: CapacityMetric, mapped: number): CalculatedCapacityViewport => ({
  metric,
  nodes: [],
  coverage: { mapped, calculated: 0, reviewed: 0, stale: 0, unknown: mapped },
  access: "sign_in_required",
  evidenceBoundary:
    "Calculated capacity requires an accepted candidate-to-model-bus link and a completed private electrical study. Unknown is not zero.",
});

export async function loadCalculatedCapacityViewport(input: {
  workspaceId?: string;
  metric: CapacityMetric;
  mappedNodeCount: number;
}): Promise<CalculatedCapacityViewport> {
  if (!input.workspaceId) return emptyViewport(input.metric, input.mappedNodeCount);
  const { data, error } = await supabase.rpc("private_capacity_map_results", {
    p_workspace_id: input.workspaceId,
    p_metric: input.metric,
  });
  if (error) throw error;
  const payload = (data ?? {}) as Partial<CalculatedCapacityViewport>;
  const calculated = payload.coverage?.calculated ?? 0;
  const stale = payload.coverage?.stale ?? 0;
  return {
    ...emptyViewport(input.metric, input.mappedNodeCount),
    ...payload,
    metric: input.metric,
    access: payload.access ?? "ready",
    coverage: {
      mapped: input.mappedNodeCount,
      calculated,
      reviewed: payload.coverage?.reviewed ?? 0,
      stale,
      unknown: Math.max(0, input.mappedNodeCount - calculated - stale),
    },
  };
}

export function isCurrentCalculatedCapacity(node?: CalculatedCapacityNode | null) {
  return Boolean(
    node &&
      node.valueMw !== null &&
      ["calculated", "operator_reviewed", "operator_confirmed"].includes(node.validationState),
  );
}

export async function reviewCalculatedCapacity(input: {
  resultId: string;
  state: "operator_reviewed" | "operator_confirmed";
  note?: string;
  validUntil?: string;
}) {
  const { data, error } = await supabase.rpc("review_node_capacity_result", {
    p_result_id: input.resultId,
    p_state: input.state,
    p_review_note: input.note ?? null,
    p_valid_until: input.validUntil ?? null,
  });
  if (error) throw error;
  return data;
}

export async function invalidateStaleCapacityResults(
  workspaceId: string,
  dependencySha256: string,
) {
  const { data, error } = await supabase.rpc("invalidate_stale_capacity_results", {
    p_workspace_id: workspaceId,
    p_dependency_sha256: dependencySha256,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
