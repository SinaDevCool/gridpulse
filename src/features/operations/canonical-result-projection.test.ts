import { describe, expect, it } from "vitest";
import { projectCanonicalAssessment } from "./canonical-result-projection";
import type { FacilityPlanRequest } from "../analytics/contracts";

const hash = "a".repeat(64);
const payload = () => ({
  schema_version: "gridpulse-facility-plan-application-result-v1",
  engine_version: "qualification", input_fingerprint: hash, result_fingerprint: hash,
  truth_class: "synthetic_demonstration", capacity_claim: false,
  automatic_live_dispatch_authorized: false,
  result: {
    status: "optimal", solver: "scipy-highs-milp", model_fingerprint: hash,
    solver_termination: "optimal", optimality_gap: 0 as number | null,
    automatic_live_dispatch_authorized: false, assessment: { feasible: true }, diagnostics: [],
    facility: { points: [{ interval_index: 0, grid_import_mw: 98, battery_charge_mw: 0, battery_discharge_mw: 5 }] },
    portfolio: { workload_trajectories: [{ workload_id: "job", points: [{ interval_index: 0 }] }] },
    battery_trajectories: [{ resource_id: "battery", points: [{ timestamp: "2026-01-01T00:00:00Z", soc_mwh: 20 }] }],
    intervals: [{ index: 0, start: "2026-01-01T00:00:00Z", duration_minutes: 15 }],
    baseline_facility: { points: [{ interval_index: 0, grid_import_mw: 103, battery_charge_mw: 0, battery_discharge_mw: 0 }] },
  },
});

describe("staged canonical cross-tab projection", () => {
  it("accepts typed additive engine diagnostics while rejecting causal or malformed evidence", () => {
    const evidence = { basis: "canonical_physical_replay", available: true, causal_binding_constraints_assessed: false,
      findings: [{ code: "peak_import_margin", asset_id: "facility", interval_index: 0, value: 2, unit: "MW", source_field: "facility.points.grid_import_mw" }] };
    expect(projectCanonicalAssessment({ ...payload(), diagnostic_evidence: evidence }, hash).identity.status).toBe("optimal");
    expect(() => projectCanonicalAssessment({ ...payload(), diagnostic_evidence: { ...evidence, causal_binding_constraints_assessed: true } }, hash)).toThrow();
    expect(() => projectCanonicalAssessment({ ...payload(), diagnostic_evidence: { ...evidence, findings: [{ ...evidence.findings[0], value: NaN }] } }, hash)).toThrow();
    expect(() => projectCanonicalAssessment({ ...payload(), invented_evidence: evidence }, hash)).toThrow();
  });
  it("accepts a bounded replay-valid incumbent without claiming optimality", () => {
    const value = payload();
    value.result.status = "feasible_not_proven_optimal";
    value.result.solver_termination = "limit_reached";
    value.result.optimality_gap = 0.02;
    expect(projectCanonicalAssessment(value, hash).identity.status).toBe("feasible_not_proven_optimal");
    value.result.optimality_gap = null;
    expect(() => projectCanonicalAssessment(value, hash)).toThrow(/gap/);
    value.result.optimality_gap = 0.1;
    expect(() => projectCanonicalAssessment(value, hash)).toThrow(/gap/);
    expect(() => projectCanonicalAssessment(payload(), hash, undefined, NaN)).toThrow(/policy/);
  });
  it("reconciles submitted resources and timestamps instead of accepting matching lengths", () => {
    const value = payload();
    const request: FacilityPlanRequest = {
      schema_version: "gridpulse-facility-plan-request-v1", portfolio_id: "p",
      requirement: {}, facility: {}, profiles: [{}], policy: {}, economics: {}, cooling: {},
      workloads: [{ workload_id: "job" }], batteries: [{ resource_id: "battery" }],
      intervals: value.result.intervals,
    };
    expect(() => projectCanonicalAssessment(value, hash, request)).not.toThrow();
    expect(() => projectCanonicalAssessment(value, hash, { ...request, batteries: [] })).toThrow(/resources/);
    expect(() => projectCanonicalAssessment(value, hash, { ...request, workloads: [{ workload_id: "another" }] })).toThrow(/resources/);
    const shifted = payload();
    shifted.result.battery_trajectories[0].points[0].timestamp = "2026-01-01T00:15:00Z";
    expect(() => projectCanonicalAssessment(shifted, hash, request)).toThrow(/horizon/);
    expect(() => projectCanonicalAssessment(value, hash, { ...request, intervals: [{ ...request.intervals[0], duration_minutes: 30 }] })).toThrow(/horizon/);
  });
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
