import { describe, expect, it } from "vitest";
import { selectCanonicalDemo } from "./canonical-demo";

function snapshot() {
  const hash = "a".repeat(64);
  const intervals = [{ index: 0, start: "2026-01-01T00:00:00Z", duration_minutes: 15 }];
  const point = { interval_index: 0, grid_import_mw: 1, battery_charge_mw: 0, battery_discharge_mw: 0.1,
    it_power_mw: 0.8, cooling_power_mw: 0.1, auxiliary_power_mw: 0.1, losses_mw: 0.1, onsite_generation_mw: 0 };
  return { request: {
    schema_version: "gridpulse-facility-plan-request-v1", portfolio_id: "demo", requirement: {}, intervals,
    facility: { facility_id: "synthetic-facility", import_limit_mw: 2 }, workloads: [{ workload_id: "j" }],
    profiles: [{}], policy: {}, economics: {}, cooling: {},
    batteries: [{ resource_id: "b", initial_soc_mwh: 1.5, minimum_reserve_mwh: 0.4, discharge_efficiency: 0.9 }],
  }, result: {
    schema_version: "gridpulse-facility-plan-application-result-v1", engine_version: "qualified",
    input_fingerprint: hash, result_fingerprint: hash, truth_class: "synthetic_demonstration", capacity_claim: false,
    automatic_live_dispatch_authorized: false, result: { status: "optimal", solver: "scipy-highs-milp",
      solver_termination: "optimal", optimality_gap: 0, model_fingerprint: hash, diagnostics: [],
      automatic_live_dispatch_authorized: false, assessment: { feasible: true }, intervals,
      facility: { points: [point] }, baseline_facility: { points: [{ ...point, grid_import_mw: 1.2 }] },
      portfolio: { workload_trajectories: [{ workload_id: "j", points: [{ interval_index: 0, status: "running",
        gpu_count: 8, power_mw: 0.8, remaining_work_hours: 1, checkpoint_or_restart: false }] }] },
      battery_trajectories: [{ resource_id: "b", points: [{ timestamp: intervals[0].start,
        soc_mwh: 1, usable_energy_mwh: 2, available_power_mw: 0.2 }] }],
    },
  } };
}

describe("synthetic MILP presentation adapter", () => {
  it("uses canonical dispatch and battery energy, without heuristic substitution", () => {
    const demo = selectCanonicalDemo(snapshot());
    expect(demo.points[0].socPercent).toBe(50);
    expect(demo.points[0].startingSocPercent).toBe(75);
    expect(demo.points[0].batteryPowerMw).toBe(0.1);
    expect(demo.protectedSocPercent).toBe(20);
    expect(demo.baselinePeakMw).toBe(1.2);
    expect(demo.jobs[0].points[0].status).toBe("running");
    expect(demo.projected.overview.identity).toBe(demo.projected.compute.identity);
  });
  it("rejects a customer facility, invalid battery data and resource mismatch", () => {
    const customer = snapshot(); customer.request.facility.facility_id = "customer";
    expect(() => selectCanonicalDemo(customer)).toThrow();
    const invalid = snapshot(); invalid.result.result.battery_trajectories[0].points[0].usable_energy_mwh = 0;
    expect(() => selectCanonicalDemo(invalid)).toThrow();
    const mismatch = snapshot(); mismatch.request.workloads[0].workload_id = "other";
    expect(() => selectCanonicalDemo(mismatch)).toThrow();
  });
});
