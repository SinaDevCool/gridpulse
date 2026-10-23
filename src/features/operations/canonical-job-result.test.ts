import { describe, expect, it } from "vitest";
import { acceptCanonicalJobResult } from "./canonical-job-result";
import { selectCanonicalPresentation } from "./canonical-presentation";
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
  it("presents the accepted no-battery trajectory without inventing SOC or a schedule", () => {
    const value = job();
    const request = { ...submitted, facility: { import_limit_mw: 2 } };
    value.input_payload.facility = request.facility;
    const power = { ...value.result_payload.result.facility.points[0], it_power_mw: 0.7,
      cooling_power_mw: 0.1, auxiliary_power_mw: 0.1, losses_mw: 0.1, onsite_generation_mw: 0 };
    value.result_payload.result.facility.points = [power];
    const execution = { interval_index: 0, status: "running", gpu_count: 8, power_mw: 0.7,
      remaining_work_hours: 0, checkpoint_or_restart: false };
    value.result_payload.result.portfolio.workload_trajectories[0].points = [execution];
    const presentation = selectCanonicalPresentation(value, request);
    expect(presentation.points[0].socPercent).toBeNull();
    expect(presentation.points[0].gridImportMw).toBe(1);
    expect(presentation.jobs[0].points[0].power_mw).toBe(0.7);
    expect(presentation.projected.overview.identity).toBe(presentation.projected.power.identity);
    value.result_payload.result.assessment.feasible = false;
    expect(() => selectCanonicalPresentation(value, request)).toThrow();
  });
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
