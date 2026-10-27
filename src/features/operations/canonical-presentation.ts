import { z } from "zod";
import { planDiagnosticEvidenceSchema, type FacilityPlanRequest } from "../analytics/contracts";
import { acceptCanonicalJobResult } from "./canonical-job-result";
import type { BatteryTimelinePoint } from "./power/select-battery-workspace";
import { canonicalBatteryPresentation } from "./canonical-battery-presentation";

const finite = z.number().finite();
const components = z.object({ it_power_mw: finite.nonnegative(), cooling_power_mw: finite.nonnegative(),
  auxiliary_power_mw: finite.nonnegative(), losses_mw: finite.nonnegative(), onsite_generation_mw: finite.nonnegative() });
const execution = z.object({ interval_index: z.number().int().nonnegative(), status: z.string(),
  gpu_count: finite.nonnegative(), power_mw: finite.nonnegative(), remaining_work_hours: finite.nonnegative(),
  checkpoint_or_restart: z.boolean() });

/** Reuses canonical acceptance and existing timeline shapes; no optimisation or replay here. */
export function selectCanonicalPresentation(rawJob: unknown, request: FacilityPlanRequest) {
  const projected = acceptCanonicalJobResult(rawJob, request);
  if (projected.power.batteries.length > 1) throw new Error("Multi-battery presentation is not qualified");
  const facility = z.object({ import_limit_mw: finite.positive() }).parse(request.facility);
  const limits = request.facility.import_limit_profile_mw == null ? null : z.array(finite.nonnegative()).length(projected.intervals.length).parse(request.facility.import_limit_profile_mw);
  const targets = request.policy.operating_target_profile_mw == null ? null : z.array(finite.nonnegative()).length(projected.intervals.length).parse(request.policy.operating_target_profile_mw);
  const target = request.policy.operating_target_mw == null ? facility.import_limit_mw :
    finite.nonnegative().parse(request.policy.operating_target_mw);
  const asset = request.batteries?.[0];
  const battery = projected.power.batteries[0];
  const batteryAudit = asset && battery ? canonicalBatteryPresentation(asset, battery.points,
    projected.power.power, projected.intervals.map(interval => interval.duration_minutes)) : null;
  const bpoints = batteryAudit?.points;
  const points: BatteryTimelinePoint[] = projected.power.power.map((point, index) => {
    const power = components.parse(point);
    const interval = projected.intervals[index];
    const state = bpoints?.[index];
    const limit = limits?.[index] ?? facility.import_limit_mw;
    const intervalTarget = targets?.[index] ?? target;
    return { timestamp: interval.start, label: interval.start, durationMinutes: interval.duration_minutes,
      baselineDemandMw: projected.overview.baseline[index].grid_import_mw,
      workloadPowerMw: projected.compute.workloads.reduce((sum, job) => sum + execution.parse(job.points[index]).power_mw, 0),
      endTimestamp: new Date(Date.parse(interval.start) + interval.duration_minutes * 60_000).toISOString(),
      facilityDemandMw: Math.max(0, power.it_power_mw + power.cooling_power_mw + power.auxiliary_power_mw + power.losses_mw - power.onsite_generation_mw),
      gridImportMw: point.grid_import_mw, batteryPowerMw: point.battery_discharge_mw - point.battery_charge_mw,
      socPercent: state && batteryAudit ? state.soc_mwh / batteryAudit.capacity * 100 : null,
      startingSocPercent: state && batteryAudit ? (index ? bpoints![index - 1].soc_mwh / batteryAudit.capacity * 100 : batteryAudit.initialSocPercent) : null,
      availableDischargeMw: state?.available_power_mw ?? null, targetMw: intervalTarget, limitMw: limit,
      shortfallMw: Math.max(0, point.grid_import_mw - intervalTarget), limitExceedanceMw: Math.max(0, point.grid_import_mw - limit),
      constraintCode: "modeled", constraintLabel: "Binding-constraint explanation unavailable",
    };
  });
  const diagnosticEvidence = z.object({ result_payload: z.object({ diagnostic_evidence: planDiagnosticEvidenceSchema.optional() }) }).safeParse(rawJob);
  return { diagnosticEvidence: diagnosticEvidence.success ? diagnosticEvidence.data.result_payload.diagnostic_evidence : undefined,
    projected, request, points, batteryAudit, limitMw: facility.import_limit_mw, targetMw: target,
    protectedSocPercent: batteryAudit?.protectedSocPercent ?? 0,
    baselinePeakMw: Math.max(...projected.overview.baseline.map(point => point.grid_import_mw)),
    planPeakMw: Math.max(...points.map(point => point.gridImportMw)),
    jobs: projected.compute.workloads.map(job => ({ id: job.workload_id,
      completionTime: job.completion_time, deadlineMet: job.deadline_met,
      endingRemainingWorkHours: job.ending_remaining_work_hours,
      points: job.points.map(point => execution.parse(point)) })),
  };
}

export type CanonicalPresentation = ReturnType<typeof selectCanonicalPresentation>;
