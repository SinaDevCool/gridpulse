import {
  operationsAssessmentRequestSchema,
  type OperationsAssessmentRequest,
} from "./assessment-request";
export {
  operationsAssessmentRequestSchema,
  type OperationsAssessmentRequest,
} from "./assessment-request";
import { assessOperations } from "./analytics";
import { operationalMeasurementSchema } from "./contracts";
import {
  assessOperationsCompliance,
  assessOperationsQuality,
  authorizeDispatch,
  evaluateResponseEconomics,
  verifyOperationsResponse,
} from "./operations-assurance";
import { buildOperationsScenario } from "./scenario-engine";
import { assessWorkloads } from "./workload-intelligence";

import { OPERATIONS_CALCULATION_VERSION } from "./calculation-version";
import { alignPowerEvidence } from "./evidence-alignment";
import { buildAssessmentPlan } from "./assessment-plan";
export { alignPowerEvidence } from "./evidence-alignment";
export { OPERATIONS_CALCULATION_VERSION } from "./calculation-version";

export function runOperationsAssessment(input: OperationsAssessmentRequest) {
  input = operationsAssessmentRequestSchema.parse(input);
  if (input.kind === "overview") {
    return envelope("simulated", buildAssessmentPlan(input.scenario, input.evidence), {
      sampleCount: 96,
      completenessPercent: 100,
      warnings: ["Scenario assumptions are not measured facility telemetry."],
    });
  }

  if (input.kind === "compute") {
    const model = buildOperationsScenario(input.scenario);
    const result = assessWorkloads(input.workloads, input.telemetry, model);
    const measuredSamples = input.telemetry.filter((point) => point.powerWatts != null).length;
    return envelope(input.telemetry.length ? "measured" : "reference", result, {
      sampleCount: input.telemetry.length,
      completenessPercent: input.telemetry.length
        ? Number(((measuredSamples / input.telemetry.length) * 100).toFixed(1))
        : 0,
      warnings: input.telemetry.length
        ? []
        : ["No GPU telemetry was supplied; power values use explicit reference estimates."],
    });
  }

  if (input.kind === "assurance") {
    const quality = assessOperationsQuality(input.quality);
    return envelope(
      "measured",
      {
        quality,
        verification: input.verification ? verifyOperationsResponse(input.verification) : null,
        compliance: assessOperationsCompliance(input.compliance),
        economics: evaluateResponseEconomics(input.economics),
        dispatch: {
          ...authorizeDispatch(input.dispatch),
          authorized: false,
          reasons: [
            ...authorizeDispatch(input.dispatch).reasons,
            "This read-only assessment service cannot authorize physical dispatch.",
          ],
        },
      },
      {
        sampleCount: input.quality.receivedIntervals,
        completenessPercent: quality.completenessPercent,
        warnings: quality.blockers,
      },
    );
  }

  const aligned = alignPowerEvidence(input.facility, input.battery);
  const measurements = aligned.map((point) =>
    operationalMeasurementSchema.parse({
      timestamp: point.timestamp,
      gridImportMw: point.facilityImportMw,
      gpuPowerMw: null,
      itLoadMw: null,
      coolingPowerMw: null,
      bessPowerMw: point.battery?.activePowerMw ?? null,
      bessSocPercent: point.battery?.socPercent ?? null,
      shiftableLoadMw: null,
    }),
  );
  const result = assessOperations({
    facilityName: input.facilityName,
    contractedLimitMw: input.contractedLimitMw,
    limitEvidence: input.limitEvidence,
    measurements,
    bess: input.batteryConfiguration,
  });
  return envelope(
    "measured",
    { ...result, alignedEvidence: aligned },
    {
      sampleCount: input.facility.length,
      completenessPercent: input.battery.length
        ? Number(
            ((aligned.filter((point) => point.battery).length / aligned.length) * 100).toFixed(1),
          )
        : 0,
      warnings:
        input.battery.length && aligned.every((point) => !point.battery)
          ? ["No BMS records could be aligned within the five-minute evidence tolerance."]
          : [],
    },
  );
}

function envelope(
  evidenceClass: "measured" | "reference" | "simulated",
  result: unknown,
  quality: { sampleCount: number; completenessPercent: number; warnings: string[] },
) {
  return {
    schemaVersion: "gridpulse-operations-assessment-v1",
    calculationVersion: OPERATIONS_CALCULATION_VERSION,
    generatedAt: new Date().toISOString(),
    evidenceClass,
    automaticDispatchAuthorized: false,
    quality,
    result,
  };
}
