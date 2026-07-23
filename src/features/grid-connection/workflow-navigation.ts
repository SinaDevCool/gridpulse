export const assessmentViews = [
  "overview",
  "strategy",
  "nodes",
  "documents",
  "evidence",
  "profile",
  "operator",
  "execution",
  "report",
  "scenarios",
  "envelopes",
  "activity",
] as const;

export type AssessmentView = (typeof assessmentViews)[number];
export type WorkflowStage = "screen" | "prepare" | "engage" | "decide";

export const workflowStages: Array<{
  key: WorkflowStage;
  number: string;
  label: string;
  title: string;
  description: string;
  defaultView: AssessmentView;
  views: Array<{ key: AssessmentView; label: string }>;
}> = [
  {
    key: "screen",
    number: "01",
    label: "Qualify",
    title: "Establish the credible connection routes",
    description:
      "Confirm the declared requirement, likely operator responsibility, and pathways worth testing.",
    defaultView: "overview",
    views: [
      { key: "overview", label: "Screening result" },
      { key: "strategy", label: "Compare pathways" },
      { key: "nodes", label: "Node intelligence" },
    ],
  },
  {
    key: "prepare",
    number: "02",
    label: "Prepare",
    title: "Build the evidence-backed application record",
    description:
      "Organise project documents, evidence provenance, and the representative operating profile.",
    defaultView: "documents",
    views: [
      { key: "documents", label: "Documents" },
      { key: "evidence", label: "Evidence ledger" },
      { key: "profile", label: "Flexibility data" },
    ],
  },
  {
    key: "engage",
    number: "03",
    label: "Engage",
    title: "Run one traceable operator conversation",
    description:
      "Prepare the requirement set, record correspondence, assign owners, and control deadlines.",
    defaultView: "operator",
    views: [
      { key: "operator", label: "Operator preparation" },
      { key: "execution", label: "Execution room" },
    ],
  },
  {
    key: "decide",
    number: "04",
    label: "Decide",
    title: "Turn validated conditions into a decision",
    description:
      "Compare supported scenarios, record the operating envelope, and preserve a versioned decision package.",
    defaultView: "report",
    views: [
      { key: "report", label: "Decision package" },
      { key: "scenarios", label: "Scenario analysis" },
      { key: "envelopes", label: "Operating envelope" },
      { key: "activity", label: "Decision record" },
    ],
  },
];

export function stageForView(view: AssessmentView) {
  return workflowStages.find((stage) => stage.views.some((item) => item.key === view))!;
}
