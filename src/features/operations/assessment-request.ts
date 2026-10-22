import { z } from "zod";
import { operationsScenarioSchema } from "./scenario-engine";
import { computeWorkloadSchema, gpuTelemetrySchema } from "./workload-intelligence";
import { germanReportingContextSchema } from "./german-evidence";

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
  z.object({
    kind: z.literal("overview"),
    scenario: operationsScenarioSchema,
    evidence: z
      .object({
        workloads: z.array(computeWorkloadSchema).max(10_000),
        telemetry: z.array(gpuTelemetrySchema).max(100_000),
        facility: z.array(facilityObservationSchema).max(100_000),
        battery: z.array(batteryObservationSchema).max(100_000),
      })
      .optional(),
  }),
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
  z.object({
    kind: z.literal("assurance"),
    quality: z.object({
      expectedIntervals: z.number().int().positive(),
      receivedIntervals: z.number().int().nonnegative(),
      duplicateCount: z.number().int().nonnegative().default(0),
      staleCount: z.number().int().nonnegative().default(0),
      suspectCount: z.number().int().nonnegative().default(0),
      newestEvidenceAt: z.string().datetime().nullable(),
      assessedAt: z.string().datetime(),
      freshnessThresholdMinutes: z.number().positive().default(15),
      powerBalanceResidualPercent: z.number().nonnegative().nullable().default(null),
    }),
    verification: z
      .object({
        requestedReductionMw: z.number().nonnegative(),
        expectedImportMw: z.number().nonnegative(),
        actualImportMw: z.array(z.number().nonnegative()).min(1),
        baselineImportMw: z.array(z.number().nonnegative()).min(1),
        intervalMinutes: z.number().positive(),
        batteryPowerMw: z.array(z.number()).optional(),
        reboundImportMw: z.array(z.number().nonnegative()).optional(),
        telemetryCompletenessPercent: z.number().min(0).max(100),
        baselineEvidenceReviewed: z.boolean().optional(),
      })
      .nullable(),
    compliance: z.object({
      facilityEnergyMwh: z.number().nonnegative().nullable(),
      itEnergyMwh: z.number().nonnegative().nullable(),
      renewableSharePercent: z.number().min(0).max(100).nullable(),
      wasteHeatMwh: z.number().nonnegative().nullable(),
      heatTemperatureC: z.number().nullable(),
      measurementCoveragePercent: z.number().min(0).max(100),
      reportingContext: germanReportingContextSchema.optional(),
    }),
    economics: z.object({
      avoidedPeakMw: z.number().nonnegative(),
      durationHours: z.number().nonnegative(),
      energyPriceEurPerMwh: z.number(),
      capacityValueEurPerMw: z.number(),
      batteryEnergyMwh: z.number().nonnegative(),
      batteryDegradationEurPerMwh: z.number().nonnegative(),
      shiftedEnergyMwh: z.number().nonnegative(),
      workloadCostEurPerMwh: z.number().nonnegative(),
      flexibilityPaymentEur: z.number(),
      slaPenaltyEur: z.number().nonnegative(),
      baselineImportMw: z.array(z.number().nonnegative()).optional(),
      proposedImportMw: z.array(z.number().nonnegative()).optional(),
      intervalHours: z.array(z.number().positive()).optional(),
      intervalPricesEurPerMwh: z.array(z.number()).optional(),
      billingPeakEvidenceReviewed: z.boolean().optional(),
    }),
    dispatch: z.object({
      mode: z.enum(["scenario", "historical", "shadow", "live"]),
      evidenceReady: z.boolean(),
      connectorHealthy: z.boolean(),
      agreementCurrent: z.boolean(),
      approvalCount: z.number().int().nonnegative(),
      requiredApprovalCount: z.number().int().positive().default(2),
      automaticDispatchEnabled: z.boolean(),
    }),
  }),
]);

export type OperationsAssessmentRequest = z.input<typeof operationsAssessmentRequestSchema>;
