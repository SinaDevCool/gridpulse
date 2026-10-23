import { z } from "zod";
import { facilityPlanRequestSchema } from "../analytics/contracts";
import { projectCanonicalAssessment } from "./canonical-result-projection";
import type { BatteryTimelinePoint } from "./power/select-battery-workspace";

const finite = z.number().finite();
const power = z.object({ it_power_mw: finite.nonnegative(), cooling_power_mw: finite.nonnegative(),
  auxiliary_power_mw: finite.nonnegative(), losses_mw: finite.nonnegative(), onsite_generation_mw: finite.nonnegative() });
const jobPoint = z.object({ interval_index: z.number().int().nonnegative(), status: z.string(),
  gpu_count: finite.nonnegative(), power_mw: finite.nonnegative(), remaining_work_hours: finite.nonnegative(),
  checkpoint_or_restart: z.boolean() });

/** Presentation only: no scheduling, dispatch or substitute physics calculations. */
export function selectCanonicalDemo(raw: unknown) {
  const snapshot = z.object({ request: facilityPlanRequestSchema, result: z.object({
    input_fingerprint: z.string(), truth_class: z.literal("synthetic_demonstration"),
  }).passthrough() }).parse(raw);
  if (snapshot.request.facility.facility_id !== "synthetic-facility")
    throw new Error("Only the fixed synthetic qualification facility is supported");
  const projected = projectCanonicalAssessment(snapshot.result, snapshot.result.input_fingerprint, snapshot.request);
  if (projected.power.batteries.length !== 1) throw new Error("Demo requires one explicit battery");
  const battery = projected.power.batteries[0];
  const config = z.object({ initial_soc_mwh: finite.nonnegative(), minimum_reserve_mwh: finite.nonnegative(),
    critical_load_mw: finite.nonnegative().default(0), backup_autonomy_minutes: finite.nonnegative().default(0),
    discharge_efficiency: finite.positive().max(1),
  }).parse(snapshot.request.batteries![0]);
  const facility = z.object({ import_limit_mw: finite.positive() }).parse(snapshot.request.facility);
  const target = snapshot.request.policy.operating_target_mw == null ? facility.import_limit_mw :
    finite.positive().parse(snapshot.request.policy.operating_target_mw);
  const bpoints = battery.points.map(point => z.object({ soc_mwh: finite.nonnegative(),
    usable_energy_mwh: finite.positive(), available_power_mw: finite.nonnegative() }).parse(point));
  const points: BatteryTimelinePoint[] = projected.power.power.map((point, index) => {
    const component = power.parse(point);
    const interval = projected.intervals[index];
    return { timestamp: interval.start, label: interval.start, durationMinutes: interval.duration_minutes,
      endTimestamp: new Date(Date.parse(interval.start) + interval.duration_minutes * 60000).toISOString(),
      facilityDemandMw: Math.max(0, component.it_power_mw + component.cooling_power_mw + component.auxiliary_power_mw + component.losses_mw - component.onsite_generation_mw),
      gridImportMw: point.grid_import_mw, batteryPowerMw: point.battery_discharge_mw - point.battery_charge_mw,
      socPercent: bpoints[index].soc_mwh / bpoints[index].usable_energy_mwh * 100,
      startingSocPercent: (index ? bpoints[index - 1].soc_mwh : config.initial_soc_mwh) / bpoints[index].usable_energy_mwh * 100,
      availableDischargeMw: bpoints[index].available_power_mw, targetMw: target, limitMw: facility.import_limit_mw,
      shortfallMw: Math.max(0, point.grid_import_mw - target), limitExceedanceMw: Math.max(0, point.grid_import_mw - facility.import_limit_mw),
      constraintCode: "modeled", constraintLabel: "Replay-valid MILP; binding equipment constraint not supplied",
    };
  });
  return { projected, request: snapshot.request, points, limitMw: facility.import_limit_mw, targetMw: target,
    protectedSocPercent: Math.max(config.minimum_reserve_mwh,
      config.critical_load_mw * config.backup_autonomy_minutes / 60 / config.discharge_efficiency) / bpoints[0].usable_energy_mwh * 100,
    baselinePeakMw: Math.max(...projected.overview.baseline.map(point => point.grid_import_mw)),
    planPeakMw: Math.max(...points.map(point => point.gridImportMw)),
    jobs: projected.compute.workloads.map(job => ({ id: job.workload_id, points: job.points.map(point => jobPoint.parse(point)) })),
  };
}

export type CanonicalDemo = ReturnType<typeof selectCanonicalDemo>;
