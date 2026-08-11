import type {
  AnonymousEnrichmentFinding,
  AnonymousProperty,
  QualificationDimensionKey,
  ScreeningAssessment,
} from "./schema";

export const SCREENING_RULE_VERSION = "screening-assessment.v1";

const confidenceOrder = { low: 0, medium: 1, high: 2 } as const;

function currentFindings(property: AnonymousProperty) {
  return (property.enrichmentFindings ?? []).filter(
    (finding) => finding.status !== "superseded" && finding.coverage === "available",
  );
}

function assessmentFor(
  key: QualificationDimensionKey,
  findings: AnonymousEnrichmentFinding[],
  now: string,
): ScreeningAssessment {
  const relevant = findings.filter((finding) => finding.category === key);
  const constraints = relevant.filter(
    (finding) => finding.polarity === "constraint" || finding.screeningEffect === "constraint",
  );
  const supporting = relevant.filter((finding) => finding.screeningEffect === "supports");
  const evidence = constraints.length ? constraints : supporting;
  const state = constraints.length
    ? "constraint_detected"
    : supporting.length
      ? "screened"
      : "unknown";
  const confidence = evidence.reduce<"high" | "medium" | "low">(
    (lowest, finding) =>
      confidenceOrder[finding.confidence] < confidenceOrder[lowest] ? finding.confidence : lowest,
    "high",
  );
  return {
    dimensionKey: key,
    state,
    summary:
      state === "constraint_detected"
        ? constraints.map((finding) => finding.displayValue).join("; ")
        : state === "screened"
          ? supporting.map((finding) => finding.displayValue).join("; ")
          : "No current public observation supports a screening assessment.",
    sourceFindingIds: evidence.map((finding) => finding.id),
    confidence: evidence.length ? confidence : "low",
    derivedAt: now,
    ruleVersion: SCREENING_RULE_VERSION,
    requiresConfirmation: true,
  };
}

export function deriveScreeningAssessments(
  property: AnonymousProperty,
  now = new Date().toISOString(),
): ScreeningAssessment[] {
  const findings = currentFindings(property);
  const keys = new Set(findings.map((finding) => finding.category));
  if (property.candidateSnapshots.length) keys.add("grid");
  if (property.municipality) keys.add("municipality");
  const assessments = [...keys].map((key) => assessmentFor(key, findings, now));
  if (
    property.candidateSnapshots.length &&
    !assessments.some((item) => item.dimensionKey === "grid" && item.state !== "unknown")
  ) {
    assessments.push({
      dimensionKey: "grid",
      state: "screened",
      summary: `${property.candidateSnapshots.length} mapped connection hypotheses captured; capacity remains unknown.`,
      sourceFindingIds: [],
      confidence: "medium",
      derivedAt: now,
      ruleVersion: SCREENING_RULE_VERSION,
      requiresConfirmation: true,
    });
  }
  if (
    property.municipality &&
    !assessments.some((item) => item.dimensionKey === "municipality" && item.state !== "unknown")
  ) {
    assessments.push({
      dimensionKey: "municipality",
      state: "screened",
      summary: `Municipality context: ${property.municipality}.`,
      sourceFindingIds: [],
      confidence: "medium",
      derivedAt: now,
      ruleVersion: SCREENING_RULE_VERSION,
      requiresConfirmation: true,
    });
  }
  return assessments;
}

export function applyScreeningAssessments(property: AnonymousProperty): AnonymousProperty {
  return { ...property, screeningAssessments: deriveScreeningAssessments(property) };
}
