export type EvidenceClass =
  | "customer_declared"
  | "public_source"
  | "derived"
  | "operator_confirmed";

export type ConfidenceLevel = "unverified" | "indicative" | "supported" | "confirmed";

export type ValidationStatus =
  | "missing"
  | "collected"
  | "needs_review"
  | "validated"
  | "rejected"
  | "expired";

export type ProjectKind =
  | "data_centre"
  | "ai_hpc_data_centre"
  | "battery_storage"
  | "industrial_load"
  | "electrolyser"
  | "hybrid_load_storage"
  | "other_large_consumer";

export type ScenarioType =
  | "requested_firm"
  | "reduced_firm"
  | "static_flexible"
  | "dynamic_flexible"
  | "staged_energisation"
  | "storage_supported"
  | "alternative_location"
  | "wait_for_reinforcement";

export type ScenarioOutcome =
  | "screening_candidate"
  | "requires_operator_study"
  | "requires_reinforcement"
  | "commercially_unacceptable"
  | "operator_supported"
  | "rejected";

export type Provenance = {
  evidenceClass: EvidenceClass;
  confidence: ConfidenceLevel;
  validationStatus: ValidationStatus;
  sourceEvidenceIds: string[];
  method?: string;
  assumptions: string[];
  limitations: string[];
  operatorValidationRequired: boolean;
  observedAt?: string;
  expiresAt?: string;
};

export type SiteScreeningInput = {
  projectKind: ProjectKind;
  latitude: number;
  longitude: number;
  requestedImportMw: number;
  minimumViableImportMw: number;
  requestedExportMw: number;
  targetVoltageKv?: number;
  targetEnergisationDate?: string;
  landStatus: "unknown" | "identified" | "optioned" | "controlled";
  planningStatus: "unknown" | "not_started" | "pre_application" | "submitted" | "approved";
  singleLineDiagramReady: boolean;
  cableRouteStatus: "unknown" | "indicative" | "secured";
  financeStatus: "unknown" | "indicative" | "committed";
};

export type FlexibilityInput = {
  requestedImportMw: number;
  firmImportMw: number;
  conditionalImportMw: number;
  minimumCriticalLoadMw: number;
  shiftableLoadMw: number;
  batteryPowerMw: number;
  batteryEnergyMwh: number;
  restrictionDurationHours: number;
  restrictionEventsPerYear: number;
  energyValueEurMwh: number;
  batteryDegradationEurMwh: number;
};

export type FlexibilityResult = {
  availableDuringRestrictionMw: number;
  grossShortfallMw: number;
  shiftableContributionMw: number;
  batteryContributionMw: number;
  residualShortfallMw: number;
  batteryDurationHours: number;
  curtailedEnergyMwhPerEvent: number;
  annualConstrainedEnergyMwh: number;
  estimatedAnnualExposureEur: number;
  compatible: boolean;
  classification: ScenarioOutcome;
  warnings: string[];
  calculationVersion: "de-fca-envelope-v2";
};

export type ConnectionScenario = {
  id: string;
  name: string;
  type: ScenarioType;
  initialImportMw: number;
  eventualImportMw: number;
  exportMw: number;
  firmness: "firm" | "conditional" | "mixed";
  operatorStatus: "unreviewed" | "submitted" | "supported" | "rejected";
  outcome: ScenarioOutcome;
  enablingAssets: string[];
  dependencies: string[];
  unresolvedEvidence: string[];
  provenance: Provenance;
};

export type DecisionTraceItem = {
  id: string;
  kind: "requirement" | "evidence" | "assumption" | "scenario" | "decision" | "action";
  label: string;
  parentIds: string[];
  evidenceIds: string[];
  confidence: ConfidenceLevel;
};
