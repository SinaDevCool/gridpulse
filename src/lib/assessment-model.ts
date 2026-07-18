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
  operator_status: string;
  assessment_status: string;
  created_at: string;
  updated_at: string;
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
