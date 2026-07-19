export type SubmissionInput = {
  project: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  capacitySnapshots: Array<Record<string, unknown>>;
  scenarios: Array<Record<string, unknown>>;
  operatorDecisions: Array<Record<string, unknown>>;
  milestones: Array<Record<string, unknown>>;
  pilot: Record<string, unknown> | null;
  questions: string[];
};

export function packageGates(input: SubmissionInput) {
  const confirmed = input.capacitySnapshots.filter((row) => row.status === "operator_confirmed");
  const operatorSources = input.documents.filter(
    (row) => row.source_classification === "operator_source",
  );
  const openMilestones = input.milestones.filter((row) => row.status !== "completed");
  return [
    {
      key: "project",
      label: "Project and requested power recorded",
      complete: Number(input.project.requested_import_mw) > 0,
    },
    {
      key: "node",
      label: "Candidate connection node identified",
      complete: input.nodes.length > 0,
    },
    { key: "evidence", label: "Evidence register populated", complete: input.evidence.length > 0 },
    {
      key: "documents",
      label: "Supporting document inventory populated",
      complete: input.documents.length > 0,
    },
    {
      key: "questions",
      label: "Operator questions prepared",
      complete: input.questions.length > 0,
    },
    {
      key: "authorization",
      label: "Customer authorizes operator engagement",
      complete: input.pilot?.engagement_authorized === true,
    },
    {
      key: "operator-source",
      label: "Operator-source document attached",
      complete: operatorSources.length > 0,
    },
    {
      key: "capacity",
      label: "Capacity statement operator-confirmed",
      complete: confirmed.length > 0,
    },
    {
      key: "milestones",
      label: "No unresolved execution gates",
      complete: openMilestones.length === 0,
    },
  ];
}

export function buildSubmissionManifest(input: SubmissionInput) {
  const gates = packageGates(input);
  const operatorConfirmedCount = input.capacitySnapshots.filter(
    (row) => row.status === "operator_confirmed",
  ).length;
  return {
    schema: "gridpulse.operator-submission.v1",
    generatedAt: new Date().toISOString(),
    truthNotice:
      "Customer-side engagement package. Only records explicitly labelled operator-confirmed represent operator evidence. This package is not a connection offer or engineering approval.",
    project: input.project,
    sections: {
      evidenceRegister: input.evidence,
      documentInventory: input.documents,
      networkNodes: input.nodes,
      capacityVersions: input.capacitySnapshots,
      connectionScenarios: input.scenarios,
      operatorDecisions: input.operatorDecisions,
      milestones: input.milestones,
      pilotAuthorization: input.pilot,
      questionsForOperator: input.questions,
    },
    releaseGates: gates,
    counts: {
      evidence: input.evidence.length,
      documents: input.documents.length,
      openGates: gates.filter((gate) => !gate.complete).length,
      operatorConfirmed: operatorConfirmedCount,
    },
  };
}

export function submissionStatus(
  openGateCount: number,
  requested: "draft" | "internal_review" | "approved_for_operator",
) {
  if (requested === "approved_for_operator" && openGateCount > 0) return "internal_review";
  return requested;
}
