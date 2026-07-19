export type CandidateSite = {
  id: string;
  user_id: string;
  name: string;
  project_type: string;
  country_code: string;
  latitude: number;
  longitude: number;
  requested_import_mw: number;
  requested_export_mw: number;
  bess_power_mw: number | null;
  bess_energy_mwh: number | null;
  target_voltage_kv: number | null;
  likely_network_operator: string | null;
  operator_profile_key: string | null;
  operator_confirmation_status: string;
  operator_status: string;
  assessment_status: string;
  target_energization_date: string | null;
  project_kind: string | null;
  minimum_viable_import_mw: number | null;
  land_status: string;
  planning_status: string;
  single_line_diagram_ready: boolean;
  cable_route_status: string;
  finance_status: string;
  load_factor: number | null;
  ramp_rate_mw_min: number | null;
  redundancy_requirement: string | null;
  decision_status: string;
  decision_notes: string | null;
  responsible_operator_name: string | null;
  responsible_operator_level: string | null;
  responsibility_source: string | null;
  responsibility_confirmed_at: string | null;
  postcode: string | null;
  municipality: string | null;
  federal_state: string | null;
  connection_challenge: string | null;
  intake_source: string;
  pilot_request_id: string | null;
  created_at: string;
  updated_at: string;
};
export type ProjectSiteCandidate = {
  id: string;
  site_id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  municipality: string | null;
  federal_state: string | null;
  target_voltage_kv: number | null;
  likely_tso: string | null;
  likely_dso: string | null;
  maturity_score: number;
  screening_status: string;
  infrastructure_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
export type OperatorPackage = {
  id: string;
  site_id: string;
  user_id: string;
  version: number;
  status: string;
  snapshot: Record<string, unknown>;
  manifest: Record<string, unknown>;
  issued_at: string | null;
  created_at: string;
};
export type AssessmentActivity = {
  id: string;
  site_id: string;
  actor_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
};
export type DecisionMemo = {
  id: string;
  site_id: string;
  version: number;
  readiness_score: number;
  workflow_status: string;
  recommended_next_action: string;
  blockers: string[];
  snapshot: Record<string, unknown>;
  created_at: string;
};
export type Evidence = {
  id: string;
  site_id: string;
  classification: string;
  title: string;
  value: unknown;
  unit: string | null;
  source_name: string | null;
  source_url: string | null;
  observed_at: string | null;
  confidence: string | null;
  validation_status: string;
  notes: string | null;
  created_at: string;
};
export type Scenario = {
  id: string;
  site_id: string;
  name: string;
  connection_mode: string;
  max_import_mw: number | null;
  max_export_mw: number | null;
  restriction_schedule: unknown;
  assumptions: unknown;
  calculation_version: string;
  status: string;
  energy_value_eur_mwh: number;
  analysis: import("@/lib/fca-engine").FcaAnalysis | null;
  profile_id: string | null;
  created_at: string;
  scenario_type: string | null;
  eventual_import_mw: number | null;
  conditional_import_mw: number;
  minimum_critical_load_mw: number | null;
  firmness: string | null;
  outcome: string | null;
  enabling_assets: unknown;
  dependencies: unknown;
  unresolved_evidence: unknown;
  provenance: unknown;
  commercial_exposure_eur: number | null;
  evidence_readiness: number;
  selection_status: string;
  selection_rationale: string | null;
  supersedes_id: string | null;
};
export type IntervalProfile = {
  id: string;
  site_id: string;
  user_id: string;
  name: string;
  source_filename: string | null;
  interval_minutes: number;
  period_start: string;
  period_end: string;
  interval_count: number;
  peak_import_mw: number;
  peak_export_mw: number;
  points: import("@/lib/fca-engine").IntervalPoint[];
  created_at: string;
  timezone: string;
  quality_status: string;
  quality_report: Record<string, unknown>;
  calculation_version: string | null;
  version: number;
  source_hash: string | null;
  source_classification: string;
  column_mapping: Record<string, unknown>;
  supersedes_id: string | null;
};
export type AssessmentDocument = {
  id: string;
  site_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  document_type: string;
  source_classification: string;
  review_status: string;
  notes: string | null;
  created_at: string;
};
export type OperatorRequirement = {
  id: string;
  site_id: string;
  requirement_key: string;
  label: string;
  category: string;
  status: string;
  document_id: string | null;
  notes: string | null;
  sort_order: number;
  profile_key: string | null;
  source_url: string | null;
};
export type OperatorProfile = {
  key: string;
  operator_name: string;
  grid_level: string;
  region_label: string;
  application_url: string;
  procedure_name: string;
  procedure_version: string;
  limitation: string;
};
export type GridDataSource = {
  key: string;
  authority: string;
  title: string;
  source_url: string;
  coverage: string;
  data_type: string;
  use_in_gridpulse: string;
  limitation: string;
  verified_on: string;
};
export type DsoDirectoryEntry = {
  key: string;
  operator_name: string;
  coverage_summary: string;
  website_url: string;
  connection_url: string;
  voltage_context: string;
  limitation: string;
  verified_on: string;
};
export type AssessmentMilestone = {
  id: string;
  site_id: string;
  title: string;
  due_at: string;
  status: string;
  milestone_type: string;
  reminder_days: number;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
};
export type AssessmentCollaborator = {
  id: string;
  site_id: string;
  invited_email: string;
  role: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
};
export type OperatorCorrespondence = {
  id: string;
  site_id: string;
  direction: string;
  contact_name: string | null;
  subject: string;
  occurred_at: string;
  summary: string;
  document_id: string | null;
  created_at: string;
};
export type FcaEnvelope = {
  id: string;
  site_id: string;
  version: number;
  name: string;
  mode: string;
  max_import_mw: number | null;
  max_export_mw: number | null;
  valid_from: string | null;
  valid_to: string | null;
  restriction_schedule: unknown;
  status: string;
  source_document_id: string | null;
  supersedes_id: string | null;
  notes: string | null;
  created_at: string;
};
export type NetworkNode = {
  id: string;
  site_id: string;
  node_name: string;
  node_code: string | null;
  operator_name: string;
  node_type: string;
  voltage_kv: number;
  latitude: number | null;
  longitude: number | null;
  source_classification: string;
  confidence: string;
  confidentiality: string;
  source_url: string | null;
  source_document_id: string | null;
  created_at: string;
};
export type NetworkAsset = {
  id: string;
  site_id: string;
  asset_name: string;
  asset_type: string;
  from_node_id: string | null;
  to_node_id: string | null;
  voltage_kv: number | null;
  normal_rating_mva: number | null;
  emergency_rating_mva: number | null;
  operational_status: string;
  source_classification: string;
  confidence: string;
  confidentiality: string;
  created_at: string;
};
export type CapacitySnapshot = {
  id: string;
  site_id: string;
  node_id: string;
  study_run_id: string | null;
  version: number;
  capacity_kind: string;
  firm_import_mw: number | null;
  firm_export_mw: number | null;
  conditional_import_mw: number | null;
  conditional_export_mw: number | null;
  network_state: string;
  methodology_version: string | null;
  observed_at: string;
  status: string;
  source_classification: string;
  confidence: string;
  confidentiality: string;
  notes: string | null;
  created_at: string;
};
export type StudyRun = {
  id: string;
  site_id: string;
  node_id: string | null;
  study_name: string;
  study_type: string;
  model_name: string;
  model_version: string;
  input_manifest: Record<string, unknown>;
  assumptions: unknown[];
  results: Record<string, unknown>;
  violations: unknown[];
  result_hash: string | null;
  status: string;
  source_classification: string;
  confidence: string;
  confidentiality: string;
  created_at: string;
};
export type OperatorDecision = {
  id: string;
  site_id: string;
  node_id: string;
  candidate_snapshot_id: string | null;
  confirmed_snapshot_id: string | null;
  source_document_id: string | null;
  decision: string;
  statement_scope: string;
  note: string;
  requested_changes: string[];
  node_corrections: Record<string, unknown>;
  valid_from: string | null;
  valid_to: string | null;
  signer_name: string;
  signer_email: string;
  signer_organization: string;
  signed_at: string;
  content_hash: string;
  created_at: string;
};

export function readiness(evidence: Evidence[]) {
  const collected = (classification: string) =>
    evidence.some(
      (item) =>
        item.classification === classification &&
        ["collected", "validated"].includes(item.validation_status),
    );
  const official = collected("official_source");
  const customer = collected("customer_input");
  const operator = evidence.some(
    (item) =>
      item.classification === "operator_validation_required" &&
      item.validation_status === "validated",
  );
  return {
    official,
    customer,
    operator,
    ready: official && customer && operator,
    completed: [official, customer, operator].filter(Boolean).length,
  };
}
export function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export function constrainedReduction(requested: number, limit: number | null) {
  return limit == null ? null : Math.max(0, Number(requested) - Number(limit));
}

const READY_REQUIREMENT_STATUSES = new Set(["ready", "submitted", "accepted", "not_applicable"]);

export function activationDecision({
  site,
  requirements,
  documents,
  profiles,
  envelopes,
}: {
  site: CandidateSite;
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  profiles: IntervalProfile[];
  envelopes: FcaEnvelope[];
}) {
  const readyRequirements = requirements.filter((item) =>
    READY_REQUIREMENT_STATUSES.has(item.status),
  ).length;
  const requirementRatio = requirements.length ? readyRequirements / requirements.length : 0;
  const operatorConfirmed = site.operator_confirmation_status !== "screening_only";
  const operatorEvidence = documents.some(
    (item) => item.source_classification === "operator_source",
  );
  const agreedEnvelope = envelopes.some((item) => item.status === "agreed");
  const hasProfile = profiles.length > 0;
  const score = Math.round(
    requirementRatio * 45 +
      Math.min(documents.length, 5) * 4 +
      (hasProfile ? 10 : 0) +
      (operatorConfirmed ? 10 : 0) +
      (operatorEvidence ? 5 : 0) +
      (agreedEnvelope ? 10 : 0),
  );
  const blockers = [
    !site.operator_profile_key ? "Route the case to a likely network operator" : null,
    !operatorConfirmed ? "Confirm the responsible operator and connection level" : null,
    requirementRatio < 1 ? "Complete the operator evidence checklist" : null,
    !hasProfile ? "Add a representative interval load or dispatch profile" : null,
    !operatorEvidence ? "Obtain written operator evidence" : null,
    !agreedEnvelope ? "Agree an operating envelope with the operator" : null,
  ].filter((item): item is string => Boolean(item));
  const nextAction = !site.operator_profile_key
    ? "Select the operator profile"
    : !operatorConfirmed
      ? "Confirm operator responsibility"
      : requirementRatio < 1
        ? "Complete the qualified application pack"
        : !operatorEvidence
          ? "Submit and log the operator response"
          : !agreedEnvelope
            ? "Negotiate the flexible connection envelope"
            : "Prepare the agreed operating plan and controls";
  return { score: Math.min(score, 100), blockers, nextAction, agreedEnvelope };
}
