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
            : "Prepare activation and operating controls";
  return { score: Math.min(score, 100), blockers, nextAction, agreedEnvelope };
}
