export type PortfolioStage =
  | "all"
  | "action_required"
  | "screening"
  | "preparing"
  | "awaiting_operator"
  | "decision_ready";

export type PortfolioSort = "priority" | "deadline" | "newest" | "name";

export type PortfolioProjectInput = {
  id: string;
  name: string;
  project_type: string;
  latitude: number;
  longitude: number;
  requested_import_mw: number;
  requested_export_mw: number;
  assessment_status: string;
  operator_status: string;
  likely_network_operator: string | null;
  operator_confirmation_status: string;
  operator_profile_key: string | null;
  decision_status: string;
  created_at: string;
  documents: number;
  requirementsReady: number;
  requirementsTotal: number;
  hasIntervalProfile: boolean;
  envelopeStatus: string;
  milestoneDueAt: string | null;
  reviews: Array<{ status: string; due_at: string | null; assigned_to_email?: string | null }>;
};

export type PortfolioProject = PortfolioProjectInput & {
  stage: Exclude<PortfolioStage, "all" | "action_required">;
  stageLabel: string;
  operatorStatusLabel: string;
  evidenceLabel: string;
  readinessScore: number;
  blockers: string[];
  nextAction: string;
  nextDeadline: string | null;
  owner: string;
  openReviews: number;
  challengedReviews: number;
  overdueActions: number;
  needsAction: boolean;
  evidenceBlocked: boolean;
  packageReady: boolean;
};

const unresolved = (status: string) => status === "open" || status === "challenged";

export function derivePortfolioProject(
  input: PortfolioProjectInput,
  now = new Date(),
): PortfolioProject {
  const operatorConfirmed = input.operator_confirmation_status === "operator_confirmed";
  const customerConfirmed = input.operator_confirmation_status === "customer_confirmed";
  const requirementsConfigured = input.requirementsTotal > 0;
  const requirementsComplete =
    requirementsConfigured && input.requirementsReady === input.requirementsTotal;
  const requirementRatio = requirementsConfigured
    ? input.requirementsReady / input.requirementsTotal
    : 0;
  const readinessScore = Math.min(
    100,
    Math.round(
      requirementRatio * 50 +
        Math.min(input.documents, 5) * 4 +
        (input.hasIntervalProfile ? 10 : 0) +
        (operatorConfirmed ? 10 : 0) +
        (input.envelopeStatus === "agreed" ? 10 : 0),
    ),
  );
  const blockers: string[] = [];
  if (!input.operator_profile_key) blockers.push("Operator routing not established");
  if (!operatorConfirmed) blockers.push("Network operator not confirmed");
  if (!requirementsConfigured) blockers.push("Operator requirements not configured");
  else if (!requirementsComplete) blockers.push("Application evidence incomplete");
  if (input.documents === 0) blockers.push("No supporting documents recorded");
  if (!input.hasIntervalProfile) blockers.push("No interval load profile recorded");

  const activeReviews = input.reviews.filter((review) => unresolved(review.status));
  const challengedReviews = activeReviews.filter((review) => review.status === "challenged").length;
  const datedReviews = activeReviews.filter((review) => review.due_at);
  const dueDates = [input.milestoneDueAt, ...datedReviews.map((review) => review.due_at)].filter(
    (value): value is string => Boolean(value),
  );
  const nextDeadline = dueDates.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  const overdueActions = dueDates.filter((date) => Date.parse(date) < now.getTime()).length;
  const packageReady =
    requirementsComplete &&
    input.documents > 0 &&
    input.hasIntervalProfile &&
    Boolean(input.operator_profile_key);

  let stage: PortfolioProject["stage"] = "screening";
  if (input.decision_status === "envelope_agreed" || input.assessment_status === "report_ready") {
    stage = "decision_ready";
  } else if (["submit_application", "operator_review"].includes(input.decision_status)) {
    stage = "awaiting_operator";
  } else if (input.decision_status === "prepare_application" || packageReady) {
    stage = "preparing";
  }

  const nextAction = !input.operator_profile_key
    ? "Establish responsible operator and routing"
    : !operatorConfirmed
      ? "Obtain operator confirmation"
      : !requirementsConfigured
        ? "Configure operator requirements"
        : !requirementsComplete
          ? "Complete the operator application package"
          : input.documents === 0
            ? "Record supporting evidence"
            : !input.hasIntervalProfile
              ? "Upload an interval load profile"
              : challengedReviews > 0
                ? "Resolve challenged review gates"
                : input.envelopeStatus === "agreed"
                  ? "Prepare the agreed operating plan"
                  : "Request an operator response or connection envelope";

  return {
    ...input,
    stage,
    stageLabel: {
      screening: "Screening",
      preparing: "Preparing package",
      awaiting_operator: "Awaiting operator",
      decision_ready: "Decision ready",
    }[stage],
    operatorStatusLabel: operatorConfirmed
      ? "Operator confirmed"
      : customerConfirmed
        ? "Customer confirmed"
        : "Screening only",
    evidenceLabel: requirementsConfigured
      ? `${input.requirementsReady}/${input.requirementsTotal} requirements ready`
      : "Requirements not configured",
    readinessScore,
    blockers,
    nextAction,
    nextDeadline,
    owner:
      activeReviews.find((review) => review.assigned_to_email)?.assigned_to_email ?? "Unassigned",
    openReviews: activeReviews.length,
    challengedReviews,
    overdueActions,
    needsAction: blockers.length > 0 || activeReviews.length > 0 || overdueActions > 0,
    evidenceBlocked: !requirementsComplete || input.documents === 0 || !input.hasIntervalProfile,
    packageReady,
  };
}

export function filterPortfolioProjects(
  projects: PortfolioProject[],
  query: string,
  stage: PortfolioStage,
  sort: PortfolioSort,
) {
  const needle = query.trim().toLocaleLowerCase();
  return projects
    .filter((project) => {
      const matchesQuery =
        !needle ||
        [project.name, project.project_type, project.likely_network_operator, project.nextAction]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(needle));
      const matchesStage =
        stage === "all" ||
        (stage === "action_required" ? project.needsAction : project.stage === stage);
      return matchesQuery && matchesStage;
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "newest") return Date.parse(b.created_at) - Date.parse(a.created_at);
      if (sort === "deadline") {
        return (
          (a.nextDeadline ? Date.parse(a.nextDeadline) : Number.MAX_SAFE_INTEGER) -
          (b.nextDeadline ? Date.parse(b.nextDeadline) : Number.MAX_SAFE_INTEGER)
        );
      }
      return (
        Number(b.overdueActions > 0) - Number(a.overdueActions > 0) ||
        b.blockers.length - a.blockers.length ||
        b.openReviews - a.openReviews
      );
    });
}
