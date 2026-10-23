import { describe, expect, it } from "vitest";
import { acceptCanonicalJobResult } from "./canonical-job-result";
import type { FacilityPlanRequest } from "../analytics/contracts";

const submitted: FacilityPlanRequest = {
  schema_version: "gridpulse-facility-plan-request-v1", portfolio_id: "p", requirement: {},
  facility: {}, intervals: [{ index: 0, start: "2026-01-01T00:00:00Z", duration_minutes: 15 }],
  workloads: [{ workload_id: "j" }], profiles: [{}], policy: {}, economics: {}, cooling: {},
};
const hash = "a".repeat(64);
function job() {
  const point = { interval_index: 0, grid_import_mw: 1, battery_charge_mw: 0, battery_discharge_mw: 0 };
  return {
    id: "00000000-0000-4000-8000-000000000001", owner_id: "00000000-0000-4000-8000-000000000002",
    job_type: "facility_plan", status: "succeeded", input_payload: { ...submitted, batteries: [], idle_gpu_power_watts: 0 },
    input_fingerprint: hash, error: null, created_at: "2026-01-01T00:00:00Z", started_at: null,
    completed_at: null, attempt_count: 1, lease_owner: null, lease_expires_at: null,
    heartbeat_at: null, checkpoint_payload: {}, cancellation_requested: false,
    result_payload: {
      schema_version: "gridpulse-facility-plan-application-result-v1", engine_version: "qualified",
      input_fingerprint: hash, result_fingerprint: hash, truth_class: "synthetic_demonstration",
      capacity_claim: false, automatic_live_dispatch_authorized: false,
      result: { status: "optimal", solver: "scipy-highs-milp", solver_termination: "optimal", optimality_gap: 0,
        model_fingerprint: hash, automatic_live_dispatch_authorized: false, assessment: { feasible: true }, diagnostics: [],
        intervals: submitted.intervals, facility: { points: [point] }, baseline_facility: { points: [point] },
        portfolio: { workload_trajectories: [{ workload_id: "j", points: [{ interval_index: 0 }] }] }, battery_trajectories: [],
      },
    },
  };
}
describe("accepted canonical job boundary", () => {
  it("normalizes transport defaults and reuses the common projection", () => {
    const accepted = acceptCanonicalJobResult(job(), submitted);
    expect(accepted.overview.identity).toBe(accepted.power.identity);
  });
  it("rejects another input snapshot even when resources match", () => {
    expect(() => acceptCanonicalJobResult(job(), { ...submitted, economics: { tariff: "changed" } })).toThrow(/snapshot/);
  });
  it("does not accept queued, cancelled or wrong-kind jobs", () => {
    expect(() => acceptCanonicalJobResult({ ...job(), status: "cancelled" }, submitted)).toThrow();
    expect(() => acceptCanonicalJobResult({ ...job(), job_type: "facility_uncertainty" }, submitted)).toThrow();
  });
});
