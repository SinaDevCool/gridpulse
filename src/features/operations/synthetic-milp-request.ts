import { mapCanonicalComponentInputs } from "./canonical-input-mapping";
import { operationsScenarioSchema, type OperationsScenario } from "./scenario-engine";
import type { FacilityPlanRequest } from "../analytics/contracts";

export const SYNTHETIC_MODEL_VERSION = "operations-public-mock-quarter-hour-v1";
export const SYNTHETIC_INTERVAL_MINUTES = 15;
export const SYNTHETIC_HORIZON_MINUTES = 1440;
export const SYNTHETIC_INTERVAL_COUNT = SYNTHETIC_HORIZON_MINUTES / SYNTHETIC_INTERVAL_MINUTES;
export const SYNTHETIC_RESOLUTION_LABEL = `${SYNTHETIC_INTERVAL_COUNT} × ${SYNTHETIC_INTERVAL_MINUTES}-minute intervals`;
const truth = "synthetic_demonstration";
const origin = Date.parse("2026-09-26T00:00:00Z");
const at = (minutes: number) => new Date(origin + minutes * 60_000).toISOString();

/** Explicit synthetic model, not inferred customer permissions or a second calculator.
 * Fixed component coefficients/profile shapes are mock assumptions; the canonical engine
 * alone calculates schedules, power, SOC and feasibility. PUE is reference-only.
 */
export function buildSyntheticMilpRequest(raw: OperationsScenario): FacilityPlanRequest {
  const scenario = operationsScenarioSchema.parse(raw);
  if (scenario.gpuCount < 20) throw new Error("The five-job demonstration requires at least 20 GPUs.");
  const specifications = [
    ["Foundation model training", "training", .28, 360, 480, 1380],
    ["Vision fine-tuning", "fine_tuning", .18, 420, 240, 1140],
    ["Embedding refresh", "data_processing", .12, 420, 120, 1080],
    ["Model evaluation", "batch_inference", .09, 480, 120, 1080],
    ["Production inference", "critical_inference", .28, 0, 1440, 1440],
  ] as const;
  const workloads = specifications.map(([name, kind, fraction, start, duration, deadline]) => {
    const count = Math.max(1, Math.floor(scenario.gpuCount * fraction));
    const power = count * scenario.gpuActivePowerWatts / 1_000_000;
    const protectedJob = kind === "critical_inference";
    return { workload_id: name, tenant_id: SYNTHETIC_MODEL_VERSION, workload_kind: kind,
      earliest_start: at(start), nominal_gpu_count: count, minimum_gpu_count: count,
      maximum_gpu_count: count, nominal_power_mw: power,
      minimum_power_cap_mw: protectedJob ? power : power * .8,
      expected_duration_minutes: duration, checkpoint_duration_minutes: 0, restart_duration_minutes: 0,
      maximum_start_delay_minutes: protectedJob ? 0 : scenario.maximumDelayMinutes,
      geographic_movement_permitted: false, allowed_site_ids: ["public-mock-site"],
      data_residency_regions: ["DE"], execution_mode: "uninterrupted",
      sla: { deadline: at(deadline), maximum_slowdown_fraction: protectedJob ? 0 : .2,
        minimum_throughput_fraction: protectedJob ? 1 : .8, maximum_pauses: 0,
        latency_boundary_ms: null, penalty_eur: 1000 },
      truth_class: truth, evidence_cutoff: at(-1440),
    };
  });
  const b = scenario.battery;
  const hasBattery = b.available && b.maximumPowerMw > 0 && b.usableEnergyMwh > 0;
  const request: FacilityPlanRequest = {
    schema_version: "gridpulse-facility-plan-request-v1", portfolio_id: SYNTHETIC_MODEL_VERSION,
    requirement: { requirement_id: SYNTHETIC_MODEL_VERSION, site_id: "public-mock-site", pcc_id: "mock-pcc",
      capacity_result_id: "synthetic-not-a-connection-offer", capacity_envelope_schema_version: "gridpulse-capacity-envelope-result-v1",
      capacity_provenance_fingerprint: "a".repeat(64), requested_import_mw: scenario.importLimitMw,
      // This mock is import-target planning, not a contracted demand-response service.
      // The reserve is mapped to policy.operating_target_mw by the shared mapper.
      firm_limit_mw: scenario.importLimitMw, conditional_limit_mw: scenario.importLimitMw,
      required_reduction_mw: 0, conservative_required_reduction_mw: 0,
      response_time_seconds: null, maximum_event_duration_minutes: null, maximum_events_per_day: null,
      maximum_events_per_year: null, maximum_annual_event_hours: null, minimum_notice_minutes: null,
      recovery_ramp_mw_per_minute: null, rebound_limit_mw: null, reactive_power_requirement: null,
      evidence_cutoff: at(-1440), truth_class: truth, operator_confirmed: false,
      capacity_is_lower_bound: false, feasible_within_conditional_envelope: true },
    intervals: Array.from({ length: SYNTHETIC_INTERVAL_COUNT }, (_, index) => ({
      index, start: at(index * SYNTHETIC_INTERVAL_MINUTES), duration_minutes: SYNTHETIC_INTERVAL_MINUTES,
    })),
    facility: { facility_id: "public-mock", site_id: "public-mock-site", import_limit_mw: scenario.importLimitMw,
      cooling_baseline_mw: 0, cooling_load_factor: .2, networking_power_mw: 0, storage_power_mw: 0,
      fixed_auxiliary_power_mw: scenario.nonGpuBaseLoadMw, ups_loss_fraction: .025,
      distribution_loss_fraction: .025, reactive_min_mvar: -scenario.importLimitMw,
      reactive_max_mvar: scenario.importLimitMw, minimum_power_factor: .95,
      maximum_phase_unbalance_fraction: .1, pue_assumption: scenario.pue, heat_reuse_mw: 0, truth_class: truth },
    workloads,
    profiles: workloads.map(job => ({ profile_id: `mock-${job.workload_id}`, workload_id: job.workload_id,
      truth_class: truth, points: [
        { gpu_count: job.nominal_gpu_count, power_cap_mw: job.nominal_power_mw * .8, throughput_fraction: .8 },
        { gpu_count: job.nominal_gpu_count, power_cap_mw: job.nominal_power_mw, throughput_fraction: 1 },
      ] })),
    batteries: hasBattery ? [{ resource_id: "public-mock-battery",
      terminal_target_mwh: b.usableEnergyMwh * b.stateOfHealthPercent / 100 * b.initialSocPercent / 100 }] : [],
    // Illustrative morning event only. Recovery outside it still respects the
    // full-horizon operating target, workload deadlines and terminal battery SOC.
    policy: { event_intervals: Array.from({ length: SYNTHETIC_INTERVAL_COUNT }, (_, index) => {
      const minute = index * SYNTHETIC_INTERVAL_MINUTES;
      return minute >= 7 * 60 && minute < 10 * 60;
    }), battery_temperature_c: Array(SYNTHETIC_INTERVAL_COUNT).fill(20),
      solver_time_limit_seconds: 30, maximum_variables: 20000, allow_cooling_reduction: false },
    economics: { import_price_eur_per_mwh: Array(SYNTHETIC_INTERVAL_COUNT).fill(100), peak_import_eur_per_mw: 1000 },
    cooling: { baseline_power_mw: 0, maximum_reduction_mw: 0, thermal_capacity_mwh: 0 },
    onsite_generation_mw: Array(SYNTHETIC_INTERVAL_COUNT).fill(0),
  };
  const mapped = mapCanonicalComponentInputs(scenario, request, {
    gpuModel: scenario.gpuModel, activeWatts: scenario.gpuActivePowerWatts,
    idleWatts: scenario.gpuIdlePowerWatts, shiftablePercent: scenario.maximumShiftablePercent,
  });
  if (!mapped.request) throw new Error(mapped.blockers.join(" "));
  return mapped.request;
}
