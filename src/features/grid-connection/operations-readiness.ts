export const OPERATIONS_READINESS_VERSION = "operations-readiness-v1";

export type OperationalSnapshot = {
  observedAt: string;
  receivedAt: string;
  telemetryQuality: "good" | "suspect" | "bad";
  limitEvidence: "operator_confirmed" | "reviewed" | "fixture";
  baselineMw: number;
  networkLimitMw: number;
  deliveredResponseMw: number;
  failSafeAvailable: boolean;
};

export type OperationalAssessment = {
  methodologyVersion: typeof OPERATIONS_READINESS_VERSION;
  status: "within_envelope" | "breach" | "cannot_assess";
  severity: "information" | "warning" | "critical";
  staleSeconds: number;
  residualExceedanceMw: number | null;
  recommendedHumanAction: string;
  automaticDispatchAuthorized: false;
  reasons: string[];
};

export function evaluateOperationalSnapshot(
  snapshot: OperationalSnapshot,
  maximumStaleSeconds = 60,
): OperationalAssessment {
  const staleSeconds = Math.max(
    0,
    Math.round(
      (new Date(snapshot.receivedAt).getTime() - new Date(snapshot.observedAt).getTime()) / 1000,
    ),
  );
  const reasons = [
    snapshot.telemetryQuality !== "good" ? "Telemetry quality is not good." : null,
    staleSeconds > maximumStaleSeconds ? "Telemetry is stale." : null,
    snapshot.limitEvidence !== "operator_confirmed"
      ? "The network limit is not operator-confirmed."
      : null,
    !snapshot.failSafeAvailable ? "Fail-safe capability is unavailable." : null,
  ].filter((reason): reason is string => Boolean(reason));
  if (reasons.length) {
    return {
      methodologyVersion: OPERATIONS_READINESS_VERSION,
      status: "cannot_assess",
      severity: snapshot.failSafeAvailable ? "warning" : "critical",
      staleSeconds,
      residualExceedanceMw: null,
      recommendedHumanAction:
        "Hold the approved fail-safe limit and have an authorized operator review the inputs.",
      automaticDispatchAuthorized: false,
      reasons,
    };
  }
  const residualExceedanceMw = Math.max(
    0,
    snapshot.baselineMw - snapshot.deliveredResponseMw - snapshot.networkLimitMw,
  );
  return {
    methodologyVersion: OPERATIONS_READINESS_VERSION,
    status: residualExceedanceMw ? "breach" : "within_envelope",
    severity: residualExceedanceMw ? "critical" : "information",
    staleSeconds,
    residualExceedanceMw: Math.round(residualExceedanceMw * 1000) / 1000,
    recommendedHumanAction: residualExceedanceMw
      ? "Escalate under the approved operating procedure and verify the fail-safe limit."
      : "Continue monitoring under the approved operating procedure.",
    automaticDispatchAuthorized: false,
    reasons: [],
  };
}
