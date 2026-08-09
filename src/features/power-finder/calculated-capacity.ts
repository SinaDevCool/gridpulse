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

export type ReferenceOperatingStrategy = {
  capacity_mw: number;
  restricted_hours: number;
  restricted_energy_mwh: number;
  maximum_reduction_mw: number;
  longest_event_hours: number;
  event_count: number;
  demand_served_percent: number;
};

export type ReferenceCapacityResult = {
  result_id: string;
  reference_bus_id: string;
  label: string;
  n0_capacity_mw: number;
  n1_capacity_mw: number;
  firm_capacity_mw: number;
  flexible_capacity_mw: number;
  bess_assisted_capacity_mw: number;
  staged_initial_capacity_mw: number;
  eventual_capacity_mw: number;
  activatable_capacity_mw: number;
  additional_unlocked_mw: number;
  activation: {
    schema_version: "gridpulse-activatable-capacity-v1";
    requested_capacity_mw: number;
    conventional_firm_mw: number;
    immediately_energisable_mw: number;
    activatable_capacity_mw: number;
    additional_unlocked_mw: number;
    flexible: ReferenceOperatingStrategy;
    bess_assisted: ReferenceOperatingStrategy & {
      battery_power_mw: number;
      battery_energy_mwh: number;
    };
    staged: {
      initial_capacity_mw: number;
      eventual_capacity_mw: number;
      representative_stage_count: number;
    };
    hourly: {
      hour_count: number;
      profile_class: string;
      samples: Array<{
        timestamp: string;
        envelope_mw: number;
        flexible_target_mw: number;
        bess_target_mw: number;
        battery_soc_mwh: number;
      }>;
    };
    result_sha256: string;
    calculation_boundary: string;
  };
  ensemble: {
    schema_version: "gridpulse-activation-ensemble-v1";
    scenario_count: number;
    hours_evaluated: number;
    electrical_ceiling_physics_verified: boolean;
    scenario_specific_physics_replays: number;
    confidence: {
      p10_mw: number;
      p50_mw: number;
      p90_mw: number;
      interpretation: string;
    };
    dominant_uncertainty: string;
    scenario_set_sha256: string;
  };
  release2_governance: ReferenceCapacityArtifact["release2_governance"];
  release3_governance: ReferenceCapacityArtifact["release3_governance"];
  release4_governance: ReferenceCapacityArtifact["release4_governance"];
  release5_governance: ReferenceCapacityArtifact["release5_governance"];
  binding_constraint: string | null;
  binding_case: string | null;
  validation_state: "reference_network_calculated";
  graph_pathway_available: boolean;
};

export type ReferenceCapacityArtifact = {
  schema_version: "gridpulse-reference-capacity-map-v1";
  generated_at: string;
  result_mode: "reference_network_calculated";
  model: {
    id: string;
    version: string;
    code: string;
    source_url: string;
    licence: string;
    model_sha256: string;
    graph_projection_sha256: string;
    topology_provider: string;
  };
  solver: { name: string; version: string };
  security: {
    criterion: string;
    contingency_ids: string[];
    operator_approved_complete_set: boolean;
  };
  strategy_assumptions: Record<string, string>;
  pilot_fixture: {
    manifest: Record<string, unknown>;
    evidence: Record<string, unknown>;
    manifest_sha256: string;
    evidence_sha256: string;
  };
  release2_governance: {
    schema_version: "gridpulse-release2-governance-v1";
    release: string;
    validation_class: "synthetic_demonstration";
    public_visibility: "governance_summary_only";
    capacity_claim: false;
    model: {
      algorithm: string;
      training_count: number;
      holdout_count: number;
      unique_capacity_labels: number;
      capacity_label_range_mw: number;
      capacity_mae_mw: number;
      false_safe_rate: number;
      dataset_hash: string;
      approved_use: string;
      prohibited_use: string;
    };
    active_learning: {
      candidate_count: number;
      physics_selected_count: number;
      mandatory_contingency_count: number;
      physics_verified_selected_count: number;
      rare_event_verified_count: number;
      selected_scenario_hash: string;
    };
    promotion: { decision: "promote" | "reject"; reason: string; rollback_required: boolean };
    manifest_sha256: string;
    warning: string;
  } | null;
  release3_governance: {
    schema_version: "gridpulse-release3-governance-v1";
    release: string;
    validation_class: "synthetic_demonstration";
    public_visibility: "governance_summary_only";
    capacity_claim: false;
    shadow: {
      scenario_count: number;
      verified_count: number;
      physics_coverage: number;
      mae_mw: number;
      p95_absolute_error_mw: number;
      bias_mw: number;
      false_safe_rate: number;
      out_of_distribution_rate: number;
      binding_accuracy: number;
      mandatory_contingency_coverage: number;
      drift_status: "stable" | "drift_detected";
      model_dataset_hash: string;
    };
    champion_decision: {
      decision: "retain_challenger" | "approve_internal_champion";
      failed_gates: string[];
      decision_sha256: string;
      capacity_claim: false;
    };
    private_observations_published: false;
    manifest_sha256: string;
    warning: string;
  } | null;
  release4_governance: {
    schema_version: "gridpulse-release4-governance-v1";
    release: string;
    validation_class: "synthetic_demonstration";
    public_visibility: "governance_summary_only";
    capacity_claim: false;
    operator_confirmed: false;
    display_as_capacity: false;
    repository_acceptance: {
      passed_gate_count: number;
      total_gate_count: number;
      all_repository_gates_passed: boolean;
      synthetic_replacement_rehearsal_complete: boolean;
    };
    graph_and_physics: {
      neo4j_provider_contract_exercised: boolean;
      physics_reference_contract_exercised: boolean;
      selected_case_count: number;
      full_case_count: number;
      compute_reduction: number;
      infeasible_recall: number;
      constraint_recall: number;
      false_safe_rate: number;
      reduced_search_qualified: boolean;
      authority_boundary: string;
    };
    operator_replacement: {
      required_field_count: number;
      operator_field_count: number;
      missing_operator_fields: string[];
      external_gates: string[];
    };
    private_operator_data_published: false;
    warning: string;
    manifest_sha256: string;
  } | null;
  release5_governance: {
    schema_version: "gridpulse-release5-acceptance-v1";
    release: string;
    methodology_version: string;
    validation_class: "synthetic_demonstration";
    gates: Record<string, boolean>;
    all_repository_gates_passed: boolean;
    benchmark: {
      extracted_facts: {
        import_limit_mw: number;
        export_limit_mw: number;
        flexibility_mode: string;
        notice_minutes: number;
        study_requirement_count: number;
        signal_count: number;
      };
      discrepancy_statuses: Record<string, "confirmed" | "conflict" | "missing_operator_evidence">;
      restriction_rehearsal: {
        required_reduction_mw: number;
        delivered_reduction_mw: number;
        residual_mw: number;
        compliant: boolean;
      };
    };
    controls: {
      human_source_review_required: true;
      linked_source_document_required: true;
      authenticated_grid_expert_approval_required: true;
      declared_values_overwritten: false;
      automatic_dispatch_authorized: false;
      operator_confirmation_created: false;
      display_as_capacity: false;
      capacity_claim: false;
    };
    external_gates: string[];
    public_visibility: "governance_summary_only";
    private_operator_data_published: false;
    warning: string;
    manifest_sha256: string;
  } | null;
  results_sha256: string;
  results: ReferenceCapacityResult[];
  permitted_interpretation: string;
  prohibited_interpretation: string;
};

export async function loadReferenceCapacityMap(): Promise<ReferenceCapacityArtifact> {
  const response = await fetch("/power-finder/reference-capacity-map.json?release=capacity-r5");
  if (!response.ok) throw new Error(`Reference capacity artifact failed (${response.status}).`);
  const artifact = (await response.json()) as ReferenceCapacityArtifact;
  if (
    artifact.schema_version !== "gridpulse-reference-capacity-map-v1" ||
    artifact.result_mode !== "reference_network_calculated"
  ) {
    throw new Error("Unsupported reference capacity artifact.");
  }
  return artifact;
}

export function referenceCapacityValue(result: ReferenceCapacityResult, metric: CapacityMetric) {
  return {
    firm_import_mw: result.firm_capacity_mw,
    flexible_import_mw: result.flexible_capacity_mw,
    bess_assisted_import_mw: result.bess_assisted_capacity_mw,
    staged_initial_import_mw: result.staged_initial_capacity_mw,
    eventual_import_mw: result.eventual_capacity_mw,
  }[metric];
}

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
