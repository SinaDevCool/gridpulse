import type {
  AssessmentDocument,
  CandidateSite,
  OperatorCorrespondence,
  OperatorRequirement,
} from "@/lib/assessment-model";

export type QualificationInput = {
  site: CandidateSite;
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  correspondence: OperatorCorrespondence[];
  preferredCandidateCount: number;
  engagementCount: number;
};

export type QualificationCheck = {
  key: string;
  label: string;
  status: "ready" | "partial" | "missing";
  points: number;
  maximum: number;
  evidence: string;
  nextAction: string | null;
};

export type OperatorQualification = {
  score: number;
  gate: "ready_to_submit" | "request_evidence" | "hold";
  checks: QualificationCheck[];
  blockers: string[];
  nextActions: string[];
  boundary: string;
};

export function assessOperatorQualification(input: QualificationInput): OperatorQualification {
  const { site, requirements, documents, correspondence } = input;
  const readyRequirements = requirements.filter((requirement) =>
    ["ready", "submitted", "accepted", "not_applicable"].includes(requirement.status),
  ).length;
  const operatorDocuments = documents.filter(
    (document) => document.source_classification === "operator_source",
  );
  const reviewedOperatorDocuments = operatorDocuments.filter((document) =>
    ["reviewed", "accepted"].includes(document.review_status),
  );
  const operatorIdentity =
    site.operator_confirmation_status === "confirmed" || Boolean(site.responsible_operator_name);
  const checks: QualificationCheck[] = [
    check(
      "requirement",
      "Declared connection requirement",
      site.requested_import_mw > 0 ? "ready" : "missing",
      15,
      site.requested_import_mw > 0
        ? `${site.requested_import_mw} MW requested import is customer-declared.`
        : "Requested import is missing.",
      "Declare the requested import and minimum viable starting point.",
    ),
    check(
      "operator",
      "Responsible operator",
      operatorIdentity ? "ready" : site.likely_network_operator ? "partial" : "missing",
      15,
      operatorIdentity
        ? `${site.responsible_operator_name ?? site.likely_network_operator} is recorded as confirmed.`
        : site.likely_network_operator
          ? `${site.likely_network_operator} is a screening route only.`
          : "No likely operator route is recorded.",
      "Confirm the responsible DSO or TSO in writing.",
    ),
    check(
      "candidate",
      "Preferred connection candidate",
      input.preferredCandidateCount > 0 ? "ready" : "missing",
      15,
      input.preferredCandidateCount > 0
        ? "A preferred mapped candidate and selection rationale are recorded."
        : "No preferred mapped connection candidate is recorded.",
      "Attach shortlisted candidates and record a preferred route with rationale.",
    ),
    check(
      "requirements",
      "Operator application checklist",
      requirements.length > 0 && readyRequirements === requirements.length
        ? "ready"
        : readyRequirements > 0
          ? "partial"
          : "missing",
      20,
      requirements.length
        ? `${readyRequirements}/${requirements.length} operator requirements are ready.`
        : "No operator-specific procedure has been applied.",
      "Apply the operator profile and close or explicitly waive each requirement.",
    ),
    check(
      "sources",
      "Reviewed operator evidence",
      reviewedOperatorDocuments.length > 0
        ? "ready"
        : operatorDocuments.length > 0
          ? "partial"
          : "missing",
      15,
      operatorDocuments.length
        ? `${reviewedOperatorDocuments.length}/${operatorDocuments.length} operator documents are reviewed.`
        : "No operator-source document is linked.",
      "Upload and review the controlling operator publication or correspondence.",
    ),
    check(
      "correspondence",
      "Traceable operator interaction",
      correspondence.length > 0 ? "ready" : "missing",
      10,
      correspondence.length
        ? `${correspondence.length} interaction${correspondence.length === 1 ? "" : "s"} recorded.`
        : "No operator interaction is recorded.",
      "Log the enquiry, meeting, or written response.",
    ),
    check(
      "engagement",
      "Controlled engagement case",
      input.engagementCount > 0 ? "ready" : "missing",
      10,
      input.engagementCount > 0
        ? "An operator engagement record is active."
        : "No controlled engagement record exists.",
      "Open an operator engagement before treating the case as submitted.",
    ),
  ];
  const score = checks.reduce((total, item) => total + item.points, 0);
  const blockers = checks.filter((item) => item.status === "missing").map((item) => item.label);
  const nextActions = checks
    .filter((item) => item.status !== "ready" && item.nextAction)
    .map((item) => item.nextAction as string);
  const gate =
    score >= 80 && blockers.length === 0
      ? "ready_to_submit"
      : score >= 50
        ? "request_evidence"
        : "hold";
  return {
    score,
    gate,
    checks,
    blockers,
    nextActions,
    boundary:
      "Qualification readiness measures workflow and evidence completeness. It does not confirm capacity, feasibility, cost, connection point, or delivery date.",
  };
}

function check(
  key: string,
  label: string,
  status: QualificationCheck["status"],
  maximum: number,
  evidence: string,
  nextAction: string,
): QualificationCheck {
  const points = status === "ready" ? maximum : status === "partial" ? Math.round(maximum / 2) : 0;
  return {
    key,
    label,
    status,
    points,
    maximum,
    evidence,
    nextAction: status === "ready" ? null : nextAction,
  };
}
