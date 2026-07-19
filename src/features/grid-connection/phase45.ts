import type { IntervalPoint, DispatchAnalysis } from "../../lib/fca-engine";
import { validateIntervalProfile } from "../../lib/fca-engine";

export const PHASE45_VERSION = "de-pilot-foundation-v1" as const;

export type EvidenceState = "declared" | "reviewed" | "operator_confirmed" | "expired";
export type ReviewRole =
  | "customer_contributor"
  | "technical_reviewer"
  | "commercial_reviewer"
  | "grid_expert"
  | "workspace_admin";
export type ReviewStage =
  | "draft"
  | "customer_complete"
  | "technical_review"
  | "expert_review"
  | "operator_ready"
  | "superseded";

export type ProfileQualityReport = {
  calculationVersion: typeof PHASE45_VERSION;
  status: "valid" | "warning" | "blocked";
  intervalMinutes: number;
  intervalCount: number;
  periodStart: string;
  periodEnd: string;
  coverageHours: number;
  peakImportMw: number;
  minimumImportMw: number;
  averageImportMw: number;
  annualisedConsumptionMwh: number;
  loadFactor: number;
  missingIntervals: number;
  duplicateTimestamps: string[];
  negativeValues: number;
  abnormalSpikes: number;
  unit: "MW";
  timezone: string;
  transformations: string[];
  warnings: string[];
  blockers: string[];
};

export type CandidateRecord = {
  id: string;
  name: string;
  municipality: string;
  likelyDso: string;
  likelyTso: string;
  targetVoltageKv: number;
  maturity: number;
  evidenceCompleteness: number;
  flexibilityCompatibility: number;
  operatorEngagement: "not_started" | "screened" | "contacted" | "confirmed";
  capacityEvidence: EvidenceState;
  blockers: string[];
};

export type CandidateScore = CandidateRecord & {
  readinessScore: number;
  band: "operator_ready" | "developing" | "early";
  nextAction: string;
};

export type ReviewRecord = {
  id: string;
  role: ReviewRole;
  status: "open" | "accepted" | "challenged";
  subject: string;
  note: string;
  createdAt: string;
};

export type OperationsEvent = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  baselineMw: number;
  networkLimitMw: number;
  batteryResponseMw: number;
  workloadResponseMw: number;
  state: "forecast" | "confirmed" | "completed";
};

export type OperationsEventResult = OperationsEvent & {
  remainingExceedanceMw: number;
  compliant: boolean;
  servedMw: number;
  disclaimer: string;
};

export type PilotMetrics = {
  assemblyMinutes: number;
  evidenceGapsFound: number;
  assumptionsChallenged: number;
  candidatesCompared: number;
  optionsEvaluated: number;
  optionsRejectedBeforeOperator: number;
  reviewCycles: number;
  operatorClarifications: number;
};

export function buildProfileQualityReport(
  points: IntervalPoint[],
  options: { timezone?: string; transformations?: string[] } = {},
): ProfileQualityReport {
  if (!points.length) throw new Error("The profile contains no intervals.");
  const quality = validateIntervalProfile(points);
  const imports = points.map((point) => point.importMw);
  const negativeValues = imports.filter((value) => value < 0).length;
  const sorted = [...imports].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const abnormalSpikes = imports.filter((value) => median > 0 && value > median * 2.5).length;
  const intervalHours = quality.intervalMinutes / 60;
  const consumptionMwh = imports.reduce(
    (sum, value) => sum + Math.max(0, value) * intervalHours,
    0,
  );
  const peak = Math.max(...imports);
  const minimum = Math.min(...imports);
  const average = imports.reduce((sum, value) => sum + value, 0) / imports.length;
  const blockers = [
    quality.duplicateTimestamps.length ? "Duplicate timestamps must be resolved." : null,
    negativeValues ? "Negative import values must be mapped or corrected." : null,
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    ...quality.warnings,
    abnormalSpikes ? `${abnormalSpikes} intervals exceed 2.5× the median load.` : null,
    points.length * intervalHours < 8_700
      ? "The profile is partial-year; annual consumption is annualised for comparison only."
      : null,
  ].filter((item): item is string => Boolean(item));
  return {
    calculationVersion: PHASE45_VERSION,
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "valid",
    intervalMinutes: quality.intervalMinutes,
    intervalCount: points.length,
    periodStart: points[0].timestamp,
    periodEnd: points.at(-1)!.timestamp,
    coverageHours: round(points.length * intervalHours),
    peakImportMw: round(peak),
    minimumImportMw: round(minimum),
    averageImportMw: round(average),
    annualisedConsumptionMwh: round(
      consumptionMwh * Math.max(1, 8_760 / (points.length * intervalHours)),
    ),
    loadFactor: peak ? round(average / peak) : 0,
    missingIntervals: quality.missingIntervals,
    duplicateTimestamps: quality.duplicateTimestamps,
    negativeValues,
    abnormalSpikes,
    unit: "MW",
    timezone: options.timezone ?? "Europe/Berlin",
    transformations: options.transformations ?? ["Timestamps normalized to UTC"],
    warnings,
    blockers,
  };
}

export function rankPilotCandidates(candidates: CandidateRecord[]): CandidateScore[] {
  return candidates
    .map((candidate) => {
      const operatorScore = { not_started: 0, screened: 35, contacted: 70, confirmed: 100 }[
        candidate.operatorEngagement
      ];
      const evidencePenalty = candidate.capacityEvidence === "operator_confirmed" ? 0 : 8;
      const readinessScore = Math.max(
        0,
        Math.round(
          candidate.maturity * 0.35 +
            candidate.evidenceCompleteness * 0.25 +
            candidate.flexibilityCompatibility * 0.2 +
            operatorScore * 0.2 -
            evidencePenalty,
        ),
      );
      return {
        ...candidate,
        readinessScore,
        band:
          readinessScore >= 75 ? "operator_ready" : readinessScore >= 45 ? "developing" : "early",
        nextAction:
          candidate.capacityEvidence !== "operator_confirmed"
            ? "Request written operator confirmation; no capacity conclusion is available."
            : candidate.blockers.length
              ? `Resolve: ${candidate.blockers[0]}`
              : "Prepare the operator-engagement package.",
      } satisfies CandidateScore;
    })
    .sort((a, b) => b.readinessScore - a.readinessScore);
}

export function simulateOperationsEvent(event: OperationsEvent): OperationsEventResult {
  const response = Math.max(0, event.batteryResponseMw) + Math.max(0, event.workloadResponseMw);
  const remainingExceedanceMw = Math.max(0, event.baselineMw - response - event.networkLimitMw);
  return {
    ...event,
    remainingExceedanceMw: round(remainingExceedanceMw),
    compliant: remainingExceedanceMw === 0,
    servedMw: round(Math.min(event.baselineMw, event.networkLimitMw + response)),
    disclaimer:
      "Simulation—not a network instruction. Limits are declared fixtures until operator supplied.",
  };
}

const allowedTransitions: Record<ReviewStage, ReviewStage[]> = {
  draft: ["customer_complete", "superseded"],
  customer_complete: ["draft", "technical_review", "superseded"],
  technical_review: ["customer_complete", "expert_review", "superseded"],
  expert_review: ["technical_review", "operator_ready", "superseded"],
  operator_ready: ["expert_review", "superseded"],
  superseded: [],
};

export function transitionReviewStage(
  current: ReviewStage,
  next: ReviewStage,
  reviews: ReviewRecord[],
) {
  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Cannot move from ${current} to ${next}.`);
  }
  if (next === "operator_ready") {
    const open = reviews.filter((review) => review.status !== "accepted");
    if (open.length) throw new Error(`${open.length} review items remain unresolved.`);
    const expertAccepted = reviews.some(
      (review) => review.role === "grid_expert" && review.status === "accepted",
    );
    if (!expertAccepted) throw new Error("Grid-expert acceptance is required.");
  }
  return next;
}

export function buildIntegrationEnvelope(input: {
  kind:
    | "network_limit"
    | "capacity_evidence"
    | "project_submission"
    | "telemetry"
    | "dispatch_response";
  organization: string;
  validFrom: string;
  validTo?: string;
  payload: Record<string, unknown>;
  evidenceState: EvidenceState;
}) {
  return {
    schemaVersion: "gridpulse.integration.v1",
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    ...input,
    controllingParty: input.organization,
    operatorValidationRequired: input.evidenceState !== "operator_confirmed",
  };
}

export function buildPilotPackage(input: {
  project: Record<string, unknown>;
  quality: ProfileQualityReport;
  candidates: CandidateScore[];
  options: Array<{ title: string; analysis: DispatchAnalysis | null }>;
  reviews: ReviewRecord[];
  metrics: PilotMetrics;
}) {
  return {
    schemaVersion: "gridpulse.operator-package.v1",
    methodologyVersion: PHASE45_VERSION,
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Customer-side operator-engagement package. It is not a connection offer, capacity confirmation, dispatch instruction or engineering approval.",
    ...input,
    requestedOperatorConfirmations: [
      "Responsible connection point and voltage level",
      "Firm import available before reinforcement",
      "Eligibility and parameters for an EnWG §17(2b) flexible agreement",
      "Control, notice, telemetry and liability requirements",
      "Studies, securities, land rights and technical documents required",
    ],
  };
}

function round(value: number) {
  return Math.round(value * 1_000) / 1_000;
}
