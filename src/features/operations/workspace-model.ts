import { evaluateOperationalSnapshot } from "../grid-connection/operations-readiness";

export type OperationsEvent = {
  id: string;
  kind: string;
  evidence_state: string;
  organization: string;
  valid_from: string;
  payload: unknown;
};
export type OperationsPoint = {
  minute: number;
  demandMw: number;
  limitMw: number;
  responseMw: number;
};

export function buildOperationsModel(
  requestedMw: number,
  firmMw: number,
  events: OperationsEvent[],
) {
  const telemetry = events.find((event) => event.kind === "telemetry");
  const limitEvent = events.find((event) => event.kind === "network_limit");
  const limitMw = numberFromPayload(limitEvent?.payload, "limit_mw") ?? firmMw;
  const now = new Date();
  const observedAt = telemetry?.valid_from ?? new Date(now.getTime() - 5 * 60_000).toISOString();
  const responseMw = Math.max(0, requestedMw - limitMw);
  const timeline = Array.from({ length: 60 }, (_, minute): OperationsPoint => {
    const restriction = minute >= 18 && minute <= 42;
    const demand = requestedMw * (0.88 + Math.sin(minute / 8) * 0.04);
    const limit = restriction ? limitMw : requestedMw;
    return { minute, demandMw: demand, limitMw: limit, responseMw: Math.max(0, demand - limit) };
  });
  const readiness = evaluateOperationalSnapshot({
    observedAt,
    receivedAt: now.toISOString(),
    telemetryQuality: telemetry?.evidence_state === "operator_confirmed" ? "good" : "suspect",
    limitEvidence:
      limitEvent?.evidence_state === "operator_confirmed" ? "operator_confirmed" : "fixture",
    baselineMw: requestedMw,
    networkLimitMw: limitMw,
    deliveredResponseMw: responseMw,
    failSafeAvailable: events.some(
      (event) =>
        event.kind === "dispatch_response" && event.evidence_state === "operator_confirmed",
    ),
  });
  return {
    timeline,
    limitMw,
    responseMw,
    observedAt,
    mode: telemetry ? "SHADOW" : "SIMULATION",
    readiness,
  };
}

function numberFromPayload(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
