import { z } from "zod";
import { assessOperations } from "./analytics";
import { operationalMeasurementSchema } from "./contracts";
import { type BatteryObservation, type FacilityPowerObservation } from "./battery-dispatch";
import {
  assessWorkloads,
  computeWorkloadSchema,
  gpuTelemetrySchema,
} from "./workload-intelligence";
import { buildOperationsScenario, operationsScenarioSchema } from "./scenario-engine";

export const OPERATIONS_CALCULATION_VERSION = "operations-backend-v1";

const facilityObservationSchema = z.object({
  timestamp: z.string().datetime(),
  facilityImportMw: z.number().nonnegative().max(5_000),
  operatingLimitMw: z.number().positive().max(5_000).nullable(),
});

const batteryObservationSchema = z.object({
  timestamp: z.string().datetime(),
  socPercent: z.number().min(0).max(100),
  activePowerMw: z.number().min(-2_000).max(2_000),
  allowedDischargeMw: z.number().nonnegative().max(2_000).nullable(),
  allowedChargeMw: z.number().nonnegative().max(2_000).nullable(),
  stateOfHealthPercent: z.number().min(0).max(100).nullable(),
  temperatureC: z.number().min(-50).max(200).nullable(),
  inverterState: z.string().max(160).nullable(),
  alarms: z.string().max(1_000).nullable(),
});

export const operationsAssessmentRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("overview"), scenario: operationsScenarioSchema }),
  z.object({
    kind: z.literal("compute"),
    scenario: operationsScenarioSchema,
    workloads: z.array(computeWorkloadSchema).min(1).max(10_000),
    telemetry: z.array(gpuTelemetrySchema).max(100_000),
  }),
  z.object({
    kind: z.literal("power"),
    facilityName: z.string().trim().min(1).max(160),
    contractedLimitMw: z.number().positive().max(5_000),
    limitEvidence: z.enum(["customer_declared", "contract_reviewed", "operator_confirmed"]),
    facility: z.array(facilityObservationSchema).min(4).max(100_000),
    battery: z.array(batteryObservationSchema).max(100_000),
    batteryConfiguration: z
      .object({
        powerMw: z.number().nonnegative().max(2_000),
        energyMwh: z.number().nonnegative().max(20_000),
        minimumReservePercent: z.number().min(0).max(100),
        roundTripEfficiency: z.number().gt(0).max(1),
      })
      .nullable(),
  }),
]);

export type OperationsAssessmentRequest = z.infer<typeof operationsAssessmentRequestSchema>;

export function runOperationsAssessment(input: OperationsAssessmentRequest) {
  if (input.kind === "overview") {
    return envelope("simulated", buildOperationsScenario(input.scenario), {
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

export function alignPowerEvidence(
  facility: FacilityPowerObservation[],
  battery: BatteryObservation[],
  toleranceMs = 5 * 60_000,
) {
  const orderedBattery = [...battery].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return [...facility]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((point) => {
      const target = Date.parse(point.timestamp);
      let closest: BatteryObservation | null = null;
      let distance = Number.POSITIVE_INFINITY;
      for (const candidate of orderedBattery) {
        const candidateDistance = Math.abs(Date.parse(candidate.timestamp) - target);
        if (candidateDistance < distance) {
          closest = candidate;
          distance = candidateDistance;
        }
        if (Date.parse(candidate.timestamp) > target + toleranceMs) break;
      }
      return { ...point, battery: distance <= toleranceMs ? closest : null };
    });
}
