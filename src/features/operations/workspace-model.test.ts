import { describe, expect, it } from "vitest";
import { buildOperationsModel } from "./workspace-model";

describe("buildOperationsModel", () => {
  it("labels missing telemetry as simulation and fails closed", () => {
    const result = buildOperationsModel(500, 420, []);
    expect(result.mode).toBe("SIMULATION");
    expect(result.readiness.status).toBe("cannot_assess");
    expect(result.readiness.automaticDispatchAuthorized).toBe(false);
  });
  it("uses an operator-confirmed limit while keeping dispatch manual", () => {
    const now = new Date().toISOString();
    const result = buildOperationsModel(500, 420, [
      {
        id: "1",
        kind: "telemetry",
        evidence_state: "operator_confirmed",
        organization: "50Hertz",
        valid_from: now,
        payload: {},
      },
      {
        id: "2",
        kind: "network_limit",
        evidence_state: "operator_confirmed",
        organization: "50Hertz",
        valid_from: now,
        payload: { limit_mw: 430 },
      },
      {
        id: "3",
        kind: "dispatch_response",
        evidence_state: "operator_confirmed",
        organization: "Site",
        valid_from: now,
        payload: {},
      },
    ]);
    expect(result.limitMw).toBe(430);
    expect(result.readiness.status).toBe("within_envelope");
    expect(result.readiness.automaticDispatchAuthorized).toBe(false);
  });
});
