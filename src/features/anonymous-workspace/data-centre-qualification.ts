import type {
  AnonymousEvidenceItem,
  AnonymousProperty,
  QualificationDimension,
  QualificationDimensionKey,
} from "./schema";

export const criticalQualificationKeys: QualificationDimensionKey[] = ["land", "planning", "grid"];

export const qualificationLabels: Record<QualificationDimensionKey, string> = {
  land: "Land & control",
  planning: "Planning & zoning",
  grid: "Grid connection",
  fibre: "Fibre & carriers",
  water_cooling: "Water & cooling",
  environment: "Environment",
  neighbours: "Neighbours & noise",
  access_logistics: "Access & logistics",
  backup_generation: "Backup generation",
  heat_reuse: "Heat reuse",
  municipality: "Municipality readiness",
};

export function evidenceIsCurrent(item: AnonymousEvidenceItem, now = new Date()) {
  return (
    !item.validTo ||
    !Number.isFinite(Date.parse(item.validTo)) ||
    Date.parse(item.validTo) >= now.getTime()
  );
}

export function evidenceSupportsDecision(item: AnonymousEvidenceItem, now = new Date()) {
  if (!evidenceIsCurrent(item, now)) return false;
  return (
    item.validationStatus === "validated" &&
    item.evidenceClass !== "public_source" &&
    item.evidenceClass !== "derived"
  );
}

export function deriveQualification(property: AnonymousProperty, now = new Date()) {
  const migratedEvidence = property.evidenceRegister ?? [];
  const accepted = new Set(
    migratedEvidence.filter((item) => evidenceSupportsDecision(item, now)).map((item) => item.id),
  );
  const dimensions = (property.qualification ?? []).map((dimension) => {
    const acceptedEvidence = dimension.evidenceIds.filter((id) => accepted.has(id)).length;
    const unsupported = dimension.status !== "unknown" && acceptedEvidence === 0;
    return { ...dimension, acceptedEvidence, unsupported };
  });
  const adverse = dimensions.filter((item) => item.status === "adverse");
  const unknown = dimensions.filter((item) => item.status === "unknown");
  const conditional = dimensions.filter((item) => item.status === "conditional");
  const unsupported = dimensions.filter((item) => item.unsupported);
  const criticalBlockers = dimensions.filter(
    (item) =>
      criticalQualificationKeys.includes(item.key) && ["unknown", "adverse"].includes(item.status),
  );
  const reviewed = dimensions.filter(
    (item) => item.status !== "unknown" && !item.unsupported,
  ).length;
  const readiness = Math.round((reviewed / Math.max(dimensions.length, 1)) * 100);
  const screenedDimensions = (property.screeningAssessments ?? []).filter(
    (item) => item.state === "screened",
  );
  const constraintsDetected = (property.screeningAssessments ?? []).filter(
    (item) => item.state === "constraint_detected",
  );
  const screeningCoverage = Math.round(
    ((screenedDimensions.length + constraintsDetected.length) / Math.max(dimensions.length, 1)) *
      100,
  );
  return {
    dimensions,
    readiness,
    confirmedReadiness: readiness,
    screeningCoverage,
    constraintsDetected: constraintsDetected.length,
    unknownDimensions: dimensions.length - screenedDimensions.length - constraintsDetected.length,
    confirmedDimensions: dimensions.filter(
      (item) => item.status !== "unknown" && !item.unsupported,
    ),
    screenedDimensions,
    adverse,
    unknown,
    conditional,
    unsupported,
    criticalBlockers,
    decisionReady:
      criticalBlockers.length === 0 && adverse.length === 0 && unsupported.length === 0,
  };
}

export function updateQualificationDimension(
  dimensions: QualificationDimension[],
  key: QualificationDimensionKey,
  patch: Partial<Omit<QualificationDimension, "key">>,
) {
  return dimensions.map((item) => (item.key === key ? { ...item, ...patch, key } : item));
}

export function operatorEvidenceAccepted(property: AnonymousProperty, now = new Date()) {
  const engagement = property.operatorEngagement;
  if (!engagement) return false;
  return (property.evidenceRegister ?? []).some(
    (item) =>
      engagement.evidenceIds.includes(item.id) &&
      item.evidenceClass === "operator_confirmed" &&
      item.validationStatus === "validated" &&
      evidenceIsCurrent(item, now),
  );
}

export function operatorReadiness(property: AnonymousProperty) {
  const engagement = property.operatorEngagement;
  if (!engagement)
    return { score: 0, checks: [], blockers: ["Operator engagement has not started"] };
  const checks = [
    {
      label: "Responsible operator confirmed",
      ready: engagement.responsibilityStatus === "operator_confirmed",
    },
    {
      label: "Preferred connection candidate selected",
      ready: Boolean(property.preferredCandidateId),
    },
    { label: "Requested power recorded", ready: (engagement.requestedImportMw ?? 0) > 0 },
    { label: "Enquiry reference recorded", ready: Boolean(engagement.enquiryReference) },
    { label: "Traceable correspondence recorded", ready: engagement.correspondence.length > 0 },
    { label: "Validated operator evidence attached", ready: operatorEvidenceAccepted(property) },
  ];
  return {
    score: Math.round((checks.filter((item) => item.ready).length / checks.length) * 100),
    checks,
    blockers: checks.filter((item) => !item.ready).map((item) => item.label),
  };
}

export function decisionRecommendationLabel(property: AnonymousProperty) {
  if (property.decisionStatus === "unreviewed") return "Unreviewed";
  if (property.decisionStatus === "advance" && !deriveQualification(property).decisionReady)
    return "Provisional advance";
  return property.decisionStatus.charAt(0).toUpperCase() + property.decisionStatus.slice(1);
}
