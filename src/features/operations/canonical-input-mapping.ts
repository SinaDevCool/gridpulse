import { facilityPlanRequestSchema, type FacilityPlanRequest } from "../analytics/contracts";
import { operationsScenarioSchema, type OperationsScenario } from "./scenario-engine";

export type ReviewedGpuCalibration = {
  gpuModel: string; activeWatts: number; idleWatts: number; shiftablePercent: number;
};

/** Component accounting only. The caller must separately pass canonical readiness checks.
 * Reviewed profiles and individual-job permissions are never invented from aggregate sliders.
 */
export function mapCanonicalComponentInputs(
  rawScenario: OperationsScenario,
  reviewed: FacilityPlanRequest,
  calibration: ReviewedGpuCalibration,
) {
  const scenario = operationsScenarioSchema.parse(rawScenario);
  const request = structuredClone(facilityPlanRequestSchema.parse(reviewed));
  const blockers: string[] = [];
  if (calibration.gpuModel !== scenario.gpuModel || calibration.activeWatts !== scenario.gpuActivePowerWatts ||
      calibration.idleWatts !== scenario.gpuIdlePowerWatts || calibration.shiftablePercent !== scenario.maximumShiftablePercent)
    blockers.push("GPU power and aggregate flexibility settings require a matching reviewed job/profile calibration.");
  const component = (key: string) => {
    const value = request.facility[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      blockers.push(`Reviewed facility component ${key} is missing or invalid.`);
      return 0;
    }
    return value;
  };
  const reservedAuxiliary = component("networking_power_mw") + component("storage_power_mw");
  if (reservedAuxiliary > scenario.nonGpuBaseLoadMw)
    blockers.push("Other facility load is smaller than reviewed networking plus storage loads.");
  request.facility.import_limit_mw = scenario.importLimitMw;
  request.facility.pue_assumption = scenario.pue;
  request.facility.fixed_auxiliary_power_mw = Math.max(0, scenario.nonGpuBaseLoadMw - reservedAuxiliary);
  request.policy.operating_target_mw = scenario.importLimitMw - scenario.safetyReserveMw;
  request.fleet_gpu_capacity = scenario.gpuCount;
  request.idle_gpu_power_watts = scenario.gpuIdlePowerWatts;
  request.policy.maximum_workload_reduction_fraction = scenario.maximumShiftablePercent / 100;
  request.workloads = request.workloads.map((job) => ({
    ...job,
    maximum_start_delay_minutes: Math.min(
      typeof job.maximum_start_delay_minutes === "number" ? job.maximum_start_delay_minutes : Infinity,
      scenario.maximumDelayMinutes,
    ),
  }));
  const b = scenario.battery;
  if (request.batteries?.length !== 1)
    blockers.push("The single-battery input panel requires exactly one reviewed battery asset; multi-asset mapping must be explicit.");
  else {
    const battery = request.batteries[0];
    const effective = b.usableEnergyMwh * b.stateOfHealthPercent / 100;
    if (effective <= 0 || b.maximumPowerMw <= 0)
      blockers.push("A disabled or zero-energy battery needs an explicit no-battery canonical model.");
    if (typeof battery.terminal_target_mwh !== "number")
      blockers.push("A reviewed terminal battery target is required.");
    request.batteries = [{ ...battery,
      rated_power_mw: b.maximumPowerMw, maximum_charge_power_mw: b.maximumChargePowerMw,
      rated_energy_mwh: b.usableEnergyMwh, degradation_fraction: 1 - b.stateOfHealthPercent / 100,
      initial_soc_mwh: effective * b.initialSocPercent / 100,
      minimum_reserve_mwh: effective * b.minimumSocPercent / 100,
      maximum_soc_fraction: b.maximumSocPercent / 100,
      charge_efficiency: b.chargeEfficiency, discharge_efficiency: b.dischargeEfficiency,
      critical_load_mw: b.criticalLoadMw ?? 0, backup_autonomy_minutes: b.backupAutonomyMinutes ?? 0,
      ramp_rate_mw_per_minute: b.rampRateMwPerMinute, minimum_dwell_minutes: b.minimumDwellMinutes,
      unavailable_hours: !b.available || !b.inverterAvailable ? request.intervals.map((_, i) => i)
        : battery.unavailable_hours ?? [],
    }];
  }
  return {
    ready: blockers.length === 0, request: blockers.length ? null : request, blockers,
    accountingMode: "components" as const,
    warnings: ["PUE is a reference in component mode; explicit cooling, UPS and distribution determine overhead.",
      "Aggregate GPU settings do not authorise pausing individual jobs; reviewed profiles and permissions remain required."],
  };
}
