import type { ProjectSiteCandidate } from "@/lib/assessment-model";

export type SiteDecisionDimensions = {
  projectMaturity: number;
  evidenceCompleteness: number;
  operatorReadiness: number;
  operationalFit: "not_tested" | "tested";
  commercialAlignment: "open" | "at_risk" | "aligned";
  blockers: string[];
  nextAction: string;
};

export function assessCandidateDimensions(
  candidate: ProjectSiteCandidate,
  projectHasProfile: boolean,
): SiteDecisionDimensions {
  const context = candidate.infrastructure_context as {
    maturityChecks?: Array<{ key: string; ready: boolean }>;
  };
  const checks = context.maturityChecks ?? [];
  const readyChecks = checks.filter((check) => check.ready);
  const operatorReady = candidate.screening_status === "operator_review";
  const evidenceCompleteness = checks.length
    ? Math.round((readyChecks.length / checks.length) * 100)
    : 0;
  const blockers = checks.filter((check) => !check.ready).map((check) => check.key);
  const commercialAlignment =
    candidate.maturity_score >= 75 && operatorReady
      ? "aligned"
      : candidate.maturity_score < 40
        ? "at_risk"
        : "open";
  return {
    projectMaturity: candidate.maturity_score,
    evidenceCompleteness,
    operatorReadiness: operatorReady ? 100 : candidate.likely_tso ? 50 : 0,
    operationalFit: projectHasProfile ? "tested" : "not_tested",
    commercialAlignment,
    blockers,
    nextAction: !candidate.likely_tso
      ? "Screen likely operator responsibility"
      : !operatorReady
        ? "Confirm operator responsibility"
        : blockers.length
          ? `Resolve ${blockers[0].replaceAll("_", " ")}`
          : projectHasProfile
            ? "Take options to operator review"
            : "Add an interval load profile",
  };
}
