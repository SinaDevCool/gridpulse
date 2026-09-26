import { z } from "zod";

export const operationalMeasurementSchema = z.object({
  timestamp: z.string().datetime(),
  gridImportMw: z.number().nonnegative(),
  gpuPowerMw: z.number().nonnegative().nullable().default(null),
  itLoadMw: z.number().nonnegative().nullable().default(null),
  coolingPowerMw: z.number().nonnegative().nullable().default(null),
  bessPowerMw: z.number().nullable().default(null),
  bessSocPercent: z.number().min(0).max(100).nullable().default(null),
  shiftableLoadMw: z.number().nonnegative().nullable().default(null),
});

export const operationsInputSchema = z.object({
  facilityName: z.string().trim().min(1).max(160),
  contractedLimitMw: z.number().positive().max(5_000),
  limitEvidence: z.enum(["customer_declared", "contract_reviewed", "operator_confirmed"]),
  measurements: z.array(operationalMeasurementSchema).min(4).max(100_000),
  bess: z.object({
    powerMw: z.number().nonnegative().max(2_000),
    energyMwh: z.number().nonnegative().max(20_000),
    minimumReservePercent: z.number().min(0).max(100),
    roundTripEfficiency: z.number().gt(0).max(1),
  }).nullable(),
});

export type OperationalMeasurement = z.infer<typeof operationalMeasurementSchema>;
export type OperationsInput = z.infer<typeof operationsInputSchema>;

export type OperationsAssessment = {
  status: "historical";
  sampleCount: number;
  startAt: string;
  endAt: string;
  intervalMinutes: number | null;
  currentImportMw: number;
  currentHeadroomMw: number;
  peakImportMw: number;
  violationCount: number;
  violationHours: number;
  maximumViolationMw: number;
  p95ImportMw: number;
  dataCompletenessPercent: number;
  forecast: null | {
    method: "seasonal_naive" | "persistence";
    horizonIntervals: number;
    peakMw: number;
    exceedanceProbabilityPercent: number;
    maeMw: number;
    baselineMaeMw: number;
    accepted: boolean;
    reason: string;
  };
  recommendation: null | {
    requiredReductionMw: number;
    bessDischargeMw: number;
    workloadShiftMw: number;
    residualViolationMw: number;
    expectedImportMw: number;
    durationMinutes: number;
    feasible: boolean;
  };
};
