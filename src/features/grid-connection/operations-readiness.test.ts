import { describe, expect, it } from "vitest";
import { evaluateOperationalSnapshot } from "./operations-readiness";

const now = "2026-07-23T12:00:30.000Z";

describe("operations readiness", () => {
  it("refuses to assess fixture limits", () => {
    expect(
      evaluateOperationalSnapshot({
        observedAt: "2026-07-23T12:00:00.000Z",
        receivedAt: now,
        telemetryQuality: "good",
        limitEvidence: "fixture",
        baselineMw: 80,
        networkLimitMw: 60,
        deliveredResponseMw: 20,
        failSafeAvailable: true,
      }),
    ).toMatchObject({
      status: "cannot_assess",
      automaticDispatchAuthorized: false,
    });
  });

  it("detects a breach only with current confirmed inputs", () => {
    expect(
      evaluateOperationalSnapshot({
        observedAt: "2026-07-23T12:00:00.000Z",
        receivedAt: now,
        telemetryQuality: "good",
        limitEvidence: "operator_confirmed",
        baselineMw: 90,
        networkLimitMw: 60,
        deliveredResponseMw: 20,
        failSafeAvailable: true,
      }),
    ).toMatchObject({ status: "breach", residualExceedanceMw: 10, severity: "critical" });
  });
});
