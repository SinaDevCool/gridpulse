import type { FacilityPlanRequest } from "../../src/features/analytics/contracts";

/** Display-only fixture. Never used by a solver, live application or production smoke test. */
export function canonicalMilpJob(request: FacilityPlanRequest) {
  const hash = "a".repeat(64);
  const battery = request.batteries?.[0];
  const points = request.intervals.map((_, interval_index) => ({ interval_index, grid_import_mw: 51,
    battery_charge_mw: 0, battery_discharge_mw: 0, it_power_mw: 30, cooling_power_mw: 6,
    auxiliary_power_mw: 12, losses_mw: 3, onsite_generation_mw: 0 }));
  return { id: "00000000-0000-4000-8000-000000000001", owner_id: "00000000-0000-4000-8000-000000000002",
    job_type: "facility_plan", status: "succeeded", input_payload: request, input_fingerprint: hash,
    error: null, created_at: "2026-09-26T00:00:00Z", completed_at: null, started_at: null,
    attempt_count: 1, lease_owner: null, lease_expires_at: null, heartbeat_at: null,
    checkpoint_payload: {}, cancellation_requested: false, result_payload: {
      schema_version: "gridpulse-facility-plan-application-result-v1", engine_version: "display-test-fixture",
      input_fingerprint: hash, result_fingerprint: hash, truth_class: "synthetic_demonstration",
      capacity_claim: false, automatic_live_dispatch_authorized: false, result: {
        status: "optimal", solver: "scipy-highs-milp", solver_termination: "optimal", optimality_gap: 0,
        model_fingerprint: hash, automatic_live_dispatch_authorized: false, assessment: { feasible: true }, diagnostics: [],
        intervals: request.intervals, facility: { points }, baseline_facility: { points: points.map(point => ({ ...point, grid_import_mw: 80 })) },
        portfolio: { workload_trajectories: request.workloads.map(job => ({ workload_id: job.workload_id,
          points: points.map(point => ({ interval_index: point.interval_index, status: "running", gpu_count: 1,
            power_mw: 6, remaining_work_hours: 0, checkpoint_or_restart: false })) })) },
        battery_trajectories: battery ? [{ resource_id: battery.resource_id, points: request.intervals.map(interval => ({
          timestamp: interval.start, soc_mwh: battery.initial_soc_mwh,
          usable_energy_mwh: Number(battery.initial_soc_mwh) - Number(battery.minimum_reserve_mwh), available_power_mw: 5,
        })) }] : [],
      },
    } };
}
