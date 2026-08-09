import type { PrivateGraphState } from "../grid-connection/private-graph-workspace";
import type { ActivationStudyMode } from "./activation-study";

export type ActivationEvidenceState =
  | "public_screening"
  | "illustrative_sandbox"
  | "assessment_saved"
  | "no_operator_workspace"
  | "workspace_ready"
  | "model_reconciliation_required"
  | "topology_accepted"
  | "physics_running"
  | "physics_verified"
  | "results_stale"
  | "operator_reviewed"
  | "operator_confirmed"
  | "unavailable"
  | "error";

export type ActivationEvidenceOrigin =
  | "public_mapped"
  | "public_registry"
  | "customer_declared"
  | "synthetic_assumption"
  | "graph_derived"
  | "physics_verified"
  | "operator_reviewed"
  | "operator_confirmed";

export type ActivationMetricEvidence = {
  origin: ActivationEvidenceOrigin;
  label: string;
  permittedInterpretation: string;
  sourceName?: string;
  sourceUrl?: string;
  version?: string;
  calculatedAt?: string;
  current: boolean;
};

export const activationEvidenceLabels: Record<ActivationEvidenceOrigin, string> = {
  public_mapped: "Public mapped",
  public_registry: "Public registry",
  customer_declared: "Customer declared",
  synthetic_assumption: "Illustrative assumption",
  graph_derived: "Graph derived",
  physics_verified: "Physics verified",
  operator_reviewed: "Operator reviewed",
  operator_confirmed: "Operator confirmed",
};

export function evidenceStateForMode(mode: ActivationStudyMode): ActivationEvidenceState {
  return {
    synthetic_demonstration: "illustrative_sandbox",
    operator_model_unvalidated: "topology_accepted",
    operator_model_reconciled: "physics_verified",
    operator_reviewed: "operator_reviewed",
    operator_confirmed: "operator_confirmed",
  }[mode] as ActivationEvidenceState;
}

export function evidenceStateForPrivateGraph(state?: PrivateGraphState): ActivationEvidenceState {
  if (!state) return "no_operator_workspace";
  return {
    no_workspace: "no_operator_workspace",
    no_model: "model_reconciliation_required",
    model_accepted: "topology_accepted",
    physics_verified: "physics_verified",
    stale: "results_stale",
  }[state] as ActivationEvidenceState;
}

export function canDisplayNodeCapacity(state: ActivationEvidenceState) {
  return ["physics_verified", "operator_reviewed", "operator_confirmed"].includes(state);
}

export function canRecommendActivationStrategy(input: {
  state: ActivationEvidenceState;
  passesMinimum: boolean;
  hasAnalysis: boolean;
  current?: boolean;
}) {
  return input.passesMinimum && input.hasAnalysis && input.current !== false && input.state !== "results_stale";
}
