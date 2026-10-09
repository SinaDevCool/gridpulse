import type { DispatchAnalysis, DispatchSettings, IntervalPoint } from "../../lib/fca-engine";

export type OptionKind =
  | "requested_firm"
  | "reduced_firm"
  | "staged"
  | "static_flexible"
  | "dynamic_flexible"
  | "storage_supported";

export type ConnectionOptionResult = {
  kind: OptionKind;
  title: string;
  initialImportMw: number;
  eventualImportMw: number;
  evidenceStatus: "customer_hypothesis" | "operator_supported";
  operationalStatus: DispatchAnalysis["classification"] | "insufficient_evidence";
  analysis: DispatchAnalysis | null;
  customerCommitments: string[];
  operatorQuestions: string[];
  warnings: string[];
};

export type ConnectionOptionInput = {
  requestedImportMw: number;
  minimumViableImportMw: number;
  reducedFirmImportMw: number;
  conditionalImportMw: number;
  operatorSupported: boolean;
  profile: IntervalPoint[] | null;
  canonicalAnalyses?: Partial<Record<OptionKind, DispatchAnalysis>>;
  dispatch: Omit<
    DispatchSettings,
    "firmImportMw" | "conditionalImportMw" | "minimumViableImportMw"
  >;
};

const operatorQuestions = {
  firm: [
    "Can the requested firm import be assessed at the identified connection point?",
    "Which reinforcement, security and application milestones control the offer?",
  ],
  reduced: [
    "Can the reduced firm import be supported before wider reinforcement?",
    "Can the connection be expanded later without a new queue position?",
  ],
  flexible: [
    "Could a static or dynamic agreement be offered under Section 17(2b) EnWG?",
    "Which signal, notice period, restriction duration, metering and control interface apply?",
  ],
  staged: [
    "Which written reinforcement milestone would release each capacity stage?",
    "What reservation conditions and securities preserve the later stage?",
  ],
  staticFlexible: [
    "Could a fixed time-window limit be offered under Section 17(2b) EnWG?",
    "Which hours, duration, notice, metering and liability rules would apply?",
  ],
  dynamicFlexible: [
    "Could a dynamic network limit be offered under Section 17(2b) EnWG?",
    "Which control signal, fail-safe limit, notice, telemetry and override rules apply?",
  ],
  storageSupported: [
    "May customer-side storage support compliance with a flexible import envelope?",
    "Which metering, protection, state-of-charge and export constraints apply?",
  ],
};

function analyse(
  input: ConnectionOptionInput,
  kind: OptionKind,
  firmImportMw: number,
  conditionalImportMw = 0,
  capabilities: { flexibleLoad: boolean; battery: boolean } = {
    flexibleLoad: false,
    battery: false,
  },
) {
  void firmImportMw;
  void conditionalImportMw;
  void capabilities;
  // Canonical interval analyses are created by durable jobs and injected into
  // this pure option composer. Never recreate the dispatch calculation here.
  return input.canonicalAnalyses?.[kind] ?? null;
}

export function buildConnectionOptions(input: ConnectionOptionInput): ConnectionOptionResult[] {
  const evidenceStatus = input.operatorSupported ? "operator_supported" : "customer_hypothesis";
  const make = (
    kind: OptionKind,
    title: string,
    initialImportMw: number,
    eventualImportMw: number,
    analysis: DispatchAnalysis | null,
    customerCommitments: string[],
    questions: string[],
  ): ConnectionOptionResult => ({
    kind,
    title,
    initialImportMw,
    eventualImportMw,
    evidenceStatus,
    operationalStatus:
      initialImportMw < input.minimumViableImportMw
        ? "fails_minimum_viable_capacity"
        : (analysis?.classification ?? "insufficient_evidence"),
    analysis,
    customerCommitments,
    operatorQuestions: questions,
    warnings: [
      ...(analysis?.warnings ?? ["Add a validated interval profile to test operational fit."]),
      ...(input.operatorSupported
        ? []
        : ["The connection limit is a planning hypothesis, not confirmed network capacity."]),
    ],
  });

  return [
    make(
      "requested_firm",
      "Requested firm",
      input.requestedImportMw,
      input.requestedImportMw,
      analyse(input, "requested_firm", input.requestedImportMw),
      [
        "No routine curtailment assumed",
        "Maintain declared power-quality and technical compliance",
      ],
      operatorQuestions.firm,
    ),
    make(
      "reduced_firm",
      "Reduced firm",
      input.reducedFirmImportMw,
      input.reducedFirmImportMw,
      analyse(input, "reduced_firm", input.reducedFirmImportMw),
      ["Accept a smaller initial operating envelope", "Keep demand within the firm limit"],
      operatorQuestions.reduced,
    ),
    make(
      "staged",
      "Staged connection",
      input.reducedFirmImportMw,
      input.requestedImportMw,
      analyse(input, "staged", input.reducedFirmImportMw),
      [
        "Commission at the initial limit",
        "Do not rely on later capacity before a written milestone",
      ],
      operatorQuestions.staged,
    ),
    make(
      "static_flexible",
      "Static flexible agreement",
      input.reducedFirmImportMw,
      input.requestedImportMw,
      analyse(input, "static_flexible", input.reducedFirmImportMw, input.conditionalImportMw * 0.6, {
        flexibleLoad: true,
        battery: false,
      }),
      ["Respect agreed time-window limits", "Operate declared workload flexibility"],
      operatorQuestions.staticFlexible,
    ),
    make(
      "dynamic_flexible",
      "Dynamic flexible agreement",
      input.reducedFirmImportMw,
      input.requestedImportMw,
      analyse(input, "dynamic_flexible", input.reducedFirmImportMw, input.conditionalImportMw, {
        flexibleLoad: true,
        battery: false,
      }),
      [
        "Respond safely to authenticated operator limits",
        "Maintain a fail-safe operating limit and auditable telemetry",
      ],
      operatorQuestions.dynamicFlexible,
    ),
    make(
      "storage_supported",
      "Storage-supported envelope",
      input.reducedFirmImportMw,
      input.requestedImportMw,
      input.dispatch.batteryPowerMw > 0
        ? analyse(input, "storage_supported", input.reducedFirmImportMw, input.conditionalImportMw * 0.6, {
            flexibleLoad: false,
            battery: true,
          })
        : null,
      [
        "Reserve usable state of charge for restriction events",
        "Accept degradation and replacement exposure",
      ],
      operatorQuestions.storageSupported,
    ),
  ];
}

export function rankConnectionOptions(options: ConnectionOptionResult[]) {
  const order: Record<ConnectionOptionResult["operationalStatus"], number> = {
    operationally_feasible: 0,
    operator_validation_required: 1,
    feasible_with_constraints: 2,
    insufficient_evidence: 3,
    fails_minimum_viable_capacity: 4,
  };
  return [...options].sort(
    (left, right) => order[left.operationalStatus] - order[right.operationalStatus],
  );
}
