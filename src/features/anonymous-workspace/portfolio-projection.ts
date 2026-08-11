import type { DecisionPortfolioRow } from "../grid-connection/portfolio-intelligence";
import type { AnonymousCandidateSnapshot, AnonymousProperty } from "./schema";
import { localCapacityState, localEvidenceGaps } from "./local-evidence-state";
import { deriveQualification, operatorReadiness } from "./data-centre-qualification";

export type AnonymousSiteStage =
  | "draft"
  | "screening"
  | "shortlisted"
  | "evidence_review"
  | "decision_ready";

export type AnonymousSiteSummary = {
  id: string;
  name: string;
  locationLabel: string;
  projectType: string;
  requiredMw: number;
  stage: AnonymousSiteStage;
  decisionStatus: AnonymousProperty["decisionStatus"];
  preferredCandidate: AnonymousCandidateSnapshot | null;
  recommendedCandidate: AnonymousCandidateSnapshot | null;
  candidateCount: number;
  evidenceScore: number | null;
  capacityState: ReturnType<typeof localCapacityState>;
  blockers: string[];
  nextAction: string;
  operator: string | null;
  qualificationReadiness: number;
  screeningCoverage: number;
  screeningConstraints: number;
  criticalBlockers: number;
  unknownDimensions: number;
  operatorEngagementStage: string;
  evidenceExpiringSoon: number;
  decisionPackageReadiness: number;
  updatedAt: string;
  property: AnonymousProperty;
};

export function preferredCandidate(property: AnonymousProperty) {
  return (
    property.candidateSnapshots.find((item) => item.id === property.preferredCandidateId) ?? null
  );
}

export function recommendedCandidate(property: AnonymousProperty) {
  return (
    property.candidateSnapshots.find((item) => item.id === property.recommendedCandidateId) ??
    [...property.candidateSnapshots].sort(
      (left, right) =>
        right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
    )[0] ??
    null
  );
}

export function projectAnonymousProperty(property: AnonymousProperty): AnonymousSiteSummary {
  const candidate = preferredCandidate(property);
  const recommended = recommendedCandidate(property);
  const qualification = deriveQualification(property);
  const operatorQualification = operatorReadiness(property);
  const capacityState = localCapacityState(property.evidence);
  const recordedOperator = property.operatorEngagement?.operatorName?.trim() || null;
  const blockers = [
    ...(property.name === "Untitled screening project"
      ? ["Give the site a client-ready name"]
      : []),
    ...(!recommended ? ["Grid screening has not produced a connection hypothesis"] : []),
    ...(!candidate && recommended ? ["Recommended connection hypothesis needs review"] : []),
    ...(recommended && !recommended.operator
      ? ["Responsible network operator is unconfirmed"]
      : []),
    ...(recommended?.missingEvidence ?? []),
    ...localEvidenceGaps(property.evidence),
    ...(property.landControlStatus === "unknown" ? ["Land control status is unknown"] : []),
    ...qualification.criticalBlockers.map(
      (item) => `${item.key.replaceAll("_", " ")} qualification is ${item.status}`,
    ),
    ...qualification.unsupported.map(
      (item) => `${item.key.replaceAll("_", " ")} finding lacks accepted evidence`,
    ),
  ];
  const uniqueBlockers = Array.from(new Set(blockers));
  let stage: AnonymousSiteStage = "draft";
  if (property.project.latitude != null && property.project.longitude != null) stage = "screening";
  if (candidate) stage = "shortlisted";
  if (candidate && property.evidence) stage = "evidence_review";
  if (candidate && qualification.decisionReady && property.decisionStatus !== "unreviewed")
    stage = "decision_ready";
  const nextAction =
    property.name === "Untitled screening project"
      ? "Name the site and confirm its development brief"
      : !recommended
        ? "Run grid screening for connection hypotheses"
        : !candidate
          ? "Review and shortlist the recommended connection hypothesis"
          : !recommended.operator
            ? "Confirm the responsible network operator"
            : capacityState !== "validated"
              ? "Resolve the highest-priority evidence gap"
              : property.decisionStatus === "unreviewed"
                ? "Record an advance, hold, or reject decision"
                : "Review the decision record and stakeholder package";
  const coordinates =
    property.project.latitude == null || property.project.longitude == null
      ? "Location not declared"
      : `${property.project.latitude.toFixed(4)}, ${property.project.longitude.toFixed(4)}`;
  return {
    id: property.id,
    name: property.name,
    locationLabel: property.siteLabel ?? property.municipality ?? coordinates,
    projectType: property.propertyType ?? property.project.type,
    requiredMw: property.requiredTotalSiteLoadMw ?? property.project.importMw,
    stage,
    decisionStatus: property.decisionStatus,
    preferredCandidate: candidate,
    recommendedCandidate: recommended,
    candidateCount: property.candidateSnapshots.length,
    evidenceScore: recommended?.evidenceScore ?? null,
    capacityState,
    blockers: uniqueBlockers,
    nextAction,
    operator: recordedOperator ?? recommended?.operator ?? null,
    qualificationReadiness: qualification.readiness,
    screeningCoverage: qualification.screeningCoverage,
    screeningConstraints: qualification.constraintsDetected,
    criticalBlockers: qualification.criticalBlockers.length,
    unknownDimensions: qualification.unknown.length,
    operatorEngagementStage: property.operatorEngagement?.enquiryStatus ?? "not_started",
    evidenceExpiringSoon: (property.evidenceRegister ?? []).filter(
      (item) =>
        item.validTo &&
        Date.parse(item.validTo) >= Date.now() &&
        Date.parse(item.validTo) <= Date.now() + 30 * 86400000,
    ).length,
    decisionPackageReadiness: Math.round(
      (qualification.readiness + operatorQualification.score) / 2,
    ),
    updatedAt: property.updatedAt,
    property,
  };
}

export function anonymousPropertyToDecisionRow(property: AnonymousProperty): DecisionPortfolioRow {
  const summary = projectAnonymousProperty(property);
  const evidence = property.evidence;
  return {
    site_id: property.id,
    site_name: property.name,
    project_type: summary.projectType,
    requested_import_mw: summary.requiredMw,
    minimum_viable_import_mw: property.project.minimumFirmMw,
    target_voltage_kv: property.project.preferredVoltageKv,
    target_energization_date: String(property.project.targetEnergisationYear),
    operator_name: summary.operator,
    engagement_status: summary.stage,
    evidence_state:
      summary.capacityState === "validated" ? "operator_confirmed" : summary.capacityState,
    indicated_import_mw:
      summary.capacityState === "validated" ? (evidence?.n1FirmCapacityMw ?? null) : null,
    reinforcement_required: null,
    reinforcement_summary: null,
    estimated_connection_cost_eur: null,
    indicated_connection_date: null,
    response_due_at: null,
    offer_expires_at: null,
    reservation_expires_at: null,
    evidence_score:
      summary.capacityState === "validated"
        ? (summary.evidenceScore ?? 65)
        : Math.min(summary.evidenceScore ?? 0, 64),
    evidence_label: summary.capacityState,
    missing_evidence: summary.blockers,
    next_deadline: evidence?.validTo ?? null,
  };
}
