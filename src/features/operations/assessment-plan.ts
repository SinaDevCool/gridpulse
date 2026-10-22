import {
  buildOperationsScenario,
  type OperationsScenario,
  type OperationsOverviewModel,
} from "./scenario-engine";
import {
  assessWorkloads,
  buildScenarioWorkloads,
  type ComputeWorkload,
  type GpuTelemetry,
  type WorkloadAssessment,
} from "./workload-intelligence";
import type { BatteryObservation, FacilityPowerObservation } from "./battery-dispatch";
import { alignPowerEvidence } from "./evidence-alignment";
import { evidenceCadenceWarnings, invalidEvidence } from "./evidence-validation";

export type AssessmentEvidence = {
  workloads: ComputeWorkload[];
  telemetry: GpuTelemetry[];
  facility: FacilityPowerObservation[];
  battery: BatteryObservation[];
};
export type AssessmentPlanDetails = {
  schemaVersion: "gridpulse-assessment-plan-v1";
  baselineSource: "synthetic";
  workloads: WorkloadAssessment;
  alignedPower: ReturnType<typeof alignPowerEvidence>;
  evidenceCounts: { facility: number; battery: number; workloads: number; telemetry: number };
  status: {
    powerTargetMet: boolean;
    recoveryComplete: boolean;
    reserveProtected: boolean;
    scenarioFeasible: boolean;
    scheduleValidated: false;
    backupAutonomyEstablished: false;
    physicalDispatchAuthorized: false;
  };
  canonical: { available: false; blockers: string[] };
  warnings: string[];
};
export const emptyAssessmentEvidence: AssessmentEvidence = {
  workloads: [],
  telemetry: [],
  facility: [],
  battery: [],
};

/** Both API entry points use the same workload screening and interval capacity cap.
 * This is still an aggregate heuristic, never a canonical job optimisation. */
export function assessSharedWorkloads(
  initialModel: OperationsOverviewModel,
  workloads: ComputeWorkload[],
  telemetry: GpuTelemetry[],
) {
  let model = initialModel;
  if (new Set(workloads.map((workload) => workload.workloadId)).size !== workloads.length)
    invalidEvidence("Duplicate workload identities require reconciliation.");
  let assessment = assessWorkloads(workloads, telemetry, model);
  if (workloads.some((workload) => workload.source !== "scenario")) {
    const capacity = model.intervals.map((point) =>
      assessment.decisions
        .filter(
          (job) =>
            job.eligible &&
            job.recommended &&
            Date.parse(point.timestamp) >= Date.parse(job.earliestStart) &&
            Date.parse(point.timestamp) <
              Date.parse(job.earliestStart) + job.expectedDurationMinutes * 60_000,
        )
        .reduce(
          (sum, job) =>
            sum +
            job.estimatedPowerMw *
              (1 - model.scenario.gpuIdlePowerWatts / model.scenario.gpuActivePowerWatts),
          0,
        ),
    );
    model = buildOperationsScenario(model.scenario, model.generatedAt, capacity);
    assessment = assessWorkloads(workloads, telemetry, model);
  }
  return { model, assessment };
}

/** One path for API and labelled browser fallback. Observations never silently
 * replace a synthetic baseline: meters cannot supply an electrical/job model. */
export function buildAssessmentPlan(
  scenario: OperationsScenario,
  evidence = emptyAssessmentEvidence,
  at = new Date().toISOString(),
) {
  const initialModel = buildOperationsScenario(scenario, at);
  const imported = evidence.workloads.filter((workload) => workload.source !== "scenario");
  const workloads = imported.length ? imported : buildScenarioWorkloads(initialModel);
  const { model, assessment } = assessSharedWorkloads(initialModel, workloads, evidence.telemetry);
  const alignedPower = alignPowerEvidence(evidence.facility, evidence.battery);
  const warnings = evidence.facility.length
    ? [
        "Uploaded power is observed evidence, not a forecast or the synthetic comparison baseline.",
        ...evidenceCadenceWarnings(alignedPower),
        ...(alignedPower.some((point) => !point.battery)
          ? ["Some meter intervals have no causally aligned BMS state."]
          : []),
      ]
    : [];
  if (evidence.telemetry.length)
    warnings.push(
      "GPU power is converted to facility-equivalent MW using assumed PUE. Partial device samples are not proof of fleet coverage.",
    );
  if (imported.length)
    warnings.push(
      "Imported job windows cap synthetic flexibility; they do not validate job completion or replace the synthetic demand baseline.",
    );
  const combined = model.summaries.find((summary) => summary.kind === "battery_workload")!;
  const plan: AssessmentPlanDetails = {
    schemaVersion: "gridpulse-assessment-plan-v1",
    baselineSource: "synthetic",
    workloads: assessment,
    alignedPower,
    evidenceCounts: {
      facility: evidence.facility.length,
      battery: evidence.battery.length,
      workloads: imported.length,
      telemetry: evidence.telemetry.length,
    },
    status: {
      powerTargetMet: model.intervals.every(
        (p) => p.combinedDemandMw <= scenario.importLimitMw - scenario.safetyReserveMw + 0.01,
      ),
      recoveryComplete: combined.unresolvedWorkMwh < 0.001,
      reserveProtected: model.intervals.every(
        (point) => point.batteryConstraintCode !== "constraint_conflict",
      ),
      scenarioFeasible: combined.feasible,
      scheduleValidated: false,
      backupAutonomyEstablished: false,
      physicalDispatchAuthorized: false,
    },
    canonical: {
      available: false,
      blockers: [
        "A reviewed facility model, job power profiles and terminal policy are required.",
        "Canonical engine availability and approved artifact have not been established by this scenario service.",
      ],
    },
    warnings,
  };
  return {
    ...model,
    assessmentPlan: plan,
    planningWarnings: [...model.planningWarnings, ...warnings],
  };
}
