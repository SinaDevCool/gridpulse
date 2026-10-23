import { describe, expect, it } from "vitest";
import { projectCanonicalAssessment } from "./canonical-result-projection";

const hash = "a".repeat(64);
const payload = () => ({
  schema_version: "gridpulse-facility-plan-application-result-v1",
  engine_version: "qualification", input_fingerprint: hash, result_fingerprint: hash,
  truth_class: "synthetic_demonstration", capacity_claim: false,
  automatic_live_dispatch_authorized: false,
  result: {
    status: "optimal", solver: "scipy-highs-milp", model_fingerprint: hash,
    automatic_live_dispatch_authorized: false, assessment: { feasible: true }, diagnostics: [],
    facility: { points: [{ interval_index: 0, grid_import_mw: 98, battery_charge_mw: 0, battery_discharge_mw: 5 }] },
    portfolio: { workload_trajectories: [{ workload_id: "job", points: [{ interval_index: 0 }] }] },
    battery_trajectories: [{ resource_id: "battery", points: [{ soc_mwh: 20 }] }],
  },
});

describe("staged canonical cross-tab projection", () => {
  it("shares one identity and the exact same power trajectory across all tabs", () => {
    const view = projectCanonicalAssessment(payload(), hash);
    expect(view.overview.identity).toBe(view.compute.identity);
    expect(view.compute.identity).toBe(view.power.identity);
    expect(view.overview.power).toBe(view.compute.power);
    expect(view.compute.power).toBe(view.power.power);
    expect(view.identity.physicalDispatchAuthorized).toBe(false);
  });
  it("rejects stale, unreplayed and misaligned results", () => {
    expect(() => projectCanonicalAssessment(payload(), "b".repeat(64))).toThrow();
    const failed = payload();
    failed.result.status = "replay_failed";
    expect(() => projectCanonicalAssessment(failed, hash)).toThrow();
    const misaligned = payload();
    misaligned.result.portfolio.workload_trajectories[0].points = [];
    expect(() => projectCanonicalAssessment(misaligned, hash)).toThrow();
  });
});
