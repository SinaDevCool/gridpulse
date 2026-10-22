import { z } from "zod";
import { planningTimeSchema } from "./planning-time";
import { operationsScenarioSchema } from "./scenario-engine";
import { computeWorkloadSchema, workloadSourceSchema } from "./workload-intelligence";

const finite = z.number().finite();
const metric = z
  .object({
    value: finite,
    evidenceClass: z.string(),
    sourceLabel: z.string(),
    quality: z.string(),
  })
  .passthrough();
const interval = z
  .object({
    timestamp: z.string().datetime(),
    ...Object.fromEntries(
      [
        "utilizationPercent",
        "activeGpuCount",
        "requestedGpuCount",
        "gpuPowerMw",
        "baselineDemandMw",
        "batteryDemandMw",
        "combinedDemandMw",
        "batteryPowerMw",
        "batterySocPercent",
        "availableDischargeMw",
        "availableChargeMw",
        "batteryShortfallMw",
        "workloadShiftMw",
        "workloadOnlyShiftMw",
        "workloadRecoveryMw",
        "workloadDemandMw",
      ].map((key) => [key, finite]),
    ),
    batteryConstraintCode: z.string(),
    batteryStartingSocPercent: finite.min(0).max(100),
    batteryStartingEnergyMwh: finite.nonnegative(),
    batteryEndingEnergyMwh: finite.nonnegative(),
    durationMinutes: finite.positive(),
  })
  .passthrough();

export const overviewResultSchema = z
  .object({
    planningTime: planningTimeSchema.optional(),
    mode: z.literal("scenario"),
    assessmentPlan: z.lazy(() => assessmentPlanSchema).optional(),
    scenario: operationsScenarioSchema,
    generatedAt: z.string().datetime(),
    intervals: z.array(interval).min(1),
    metrics: z.object({
      facilityDemand: metric,
      operationalLimit: metric,
      remainingMargin: metric,
      additionalGpus: metric,
      limitRisk: metric
        .omit({ value: true })
        .extend({ value: z.enum(["Low", "Moderate", "High"]) }),
    }),
    summaries: z.array(
      z.object({
        kind: z.enum(["baseline", "battery", "workload", "battery_workload"]),
        label: z.string(),
        peakDemandMw: finite,
        violationIntervals: finite,
        violationHours: finite,
        totalEnergyMwh: finite,
        additionalGpuHours: finite,
        feasible: z.boolean(),
        unresolvedWorkMwh: finite,
      }),
    ),
    recommendation: z.object({
      batteryMw: finite,
      durationMinutes: finite,
      workloadMwh: finite,
      violationsAvoided: finite,
      peakReductionMw: finite,
      additionalGpuHours: finite,
    }),
    operatingEnvelope: z.object({
      intervals: z
        .array(
          z
            .object({
              timestamp: z.string().datetime(),
              directCeilingMw: finite,
              batteryCeilingMw: finite,
              combinedCeilingMw: finite,
              residualShortfallMw: finite,
            })
            .passthrough(),
        )
        .min(1),
      summary: z.record(z.unknown()),
    }),
    planningWarnings: z.array(z.string()),
  })
  .passthrough();

export const workloadResultSchema = z
  .object({
    source: workloadSourceSchema,
    decisions: z.array(
      computeWorkloadSchema.and(
        z.object({
          estimatedPowerMw: finite,
          powerEvidence: z.enum(["measured", "reference"]),
          deadlineSlackMinutes: finite,
          eligible: z.boolean(),
          recommended: z.boolean(),
          reason: z.string(),
          proposedStart: z.string().datetime(),
          peakReductionMw: finite,
        }),
      ),
    ),
    ...Object.fromEntries(
      [
        "affectedJobs",
        "eligibleJobs",
        "flexiblePowerMw",
        "flexibleEnergyMwh",
        "recommendedJobs",
        "recommendedPowerMw",
        "recommendedEnergyMwh",
        "requiredWorkloadResponseMw",
        "deadlinesAtRisk",
        "telemetryCompletenessPercent",
      ].map((key) => [key, finite]),
    ),
  })
  .passthrough();

export const assessmentEnvelopeSchema = z.object({
  schemaVersion: z.literal("gridpulse-operations-assessment-v1"),
  calculationVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  evidenceClass: z.enum(["measured", "reference", "simulated"]),
  automaticDispatchAuthorized: z.literal(false),
  assessmentId: z.string().uuid(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  quality: z.object({
    sampleCount: z.number().int().nonnegative(),
    completenessPercent: finite.min(0).max(100),
    warnings: z.array(z.string()),
  }),
  result: z.record(z.unknown()),
});

export const powerResultSchema = z
  .object({
    status: z.literal("historical"),
    sampleCount: finite.int().nonnegative(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    intervalMinutes: finite.nullable(),
    currentImportMw: finite,
    currentHeadroomMw: finite,
    peakImportMw: finite,
    violationCount: finite.int().nonnegative(),
    violationHours: finite,
    maximumViolationMw: finite,
    p95ImportMw: finite,
    dataCompletenessPercent: finite.min(0).max(100),
    forecast: z
      .object({
        method: z.enum(["seasonal_naive", "persistence"]),
        horizonIntervals: finite,
        peakMw: finite,
        exceedanceProbabilityPercent: finite,
        maeMw: finite,
        baselineMaeMw: finite,
        accepted: z.boolean(),
        reason: z.string(),
      })
      .nullable(),
    recommendation: z
      .object({
        requiredReductionMw: finite,
        bessDischargeMw: finite,
        workloadShiftMw: finite,
        residualViolationMw: finite,
        expectedImportMw: finite,
        durationMinutes: finite,
        feasible: z.boolean(),
      })
      .nullable(),
    alignedEvidence: z.array(
      z.object({
        timestamp: z.string().datetime(),
        facilityImportMw: finite,
        operatingLimitMw: finite.nullable(),
        battery: z
          .object({
            timestamp: z.string().datetime(),
            socPercent: finite.min(0).max(100),
            activePowerMw: finite,
          })
          .passthrough()
          .nullable(),
      }),
    ),
  })
  .passthrough();

export const assuranceResultSchema = z
  .object({
    quality: z.object({
      completenessPercent: finite.min(0).max(100),
      freshnessMinutes: finite.nullable(),
      duplicateCount: finite.int().nonnegative(),
      staleCount: finite.int().nonnegative(),
      suspectCount: finite.int().nonnegative(),
      powerBalanceResidualPercent: finite.nullable(),
      status: z.enum(["ready", "limited", "scenario_only"]),
      blockers: z.array(z.string()),
    }),
    verification: z
      .object({
        requestedReductionMw: finite,
        deliveredReductionMw: finite,
        deliveredEnergyMwh: finite,
        batteryEnergyMwh: finite,
        reboundEnergyMwh: finite,
        netDeliveredEnergyMwh: finite,
        performancePercent: finite,
        verified: z.boolean(),
        dataEvaluable: z.boolean(),
        performanceAchieved: z.boolean(),
        recoveryAssessed: z.boolean(),
        baselineValidated: z.boolean(),
        confidence: z.enum(["high", "medium", "low"]),
      })
      .nullable(),
    compliance: z
      .object({
        measuredPue: finite.nullable(),
        evidenceReady: z.boolean(),
        missing: z.array(z.string()),
      })
      .passthrough(),
    economics: z.object({
      available: z.boolean(),
      reason: z.string(),
      avoidedEnergyCostEur: finite.nullable(),
      avoidedCapacityCostEur: finite.nullable(),
      batteryCostEur: finite.nullable(),
      workloadCostEur: finite.nullable(),
      grossValueEur: finite.nullable(),
      netValueEur: finite.nullable(),
    }),
    dispatch: z.object({
      authorized: z.boolean(),
      failClosed: z.literal(true),
      reasons: z.array(z.string()),
    }),
  })
  .passthrough();

export const operationsCapabilitiesSchema = z.object({
  schemaVersion: z.literal("gridpulse-operations-capabilities-v1"),
  persistence: z.object({ configured: z.boolean(), provider: z.string() }),
  connectors: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: z.string(),
      transport: z.string(),
      evidence: z.array(z.string()),
    }),
  ),
});

export const assessmentPlanSchema = z.object({
  schemaVersion: z.literal("gridpulse-assessment-plan-v1"),
  baselineSource: z.literal("synthetic"),
  workloads: workloadResultSchema,
  alignedPower: powerResultSchema.shape.alignedEvidence,
  evidenceCounts: z.object({
    facility: finite.int().nonnegative(),
    battery: finite.int().nonnegative(),
    workloads: finite.int().nonnegative(),
    telemetry: finite.int().nonnegative(),
  }),
  status: z.object({
    powerTargetMet: z.boolean(),
    recoveryComplete: z.boolean(),
    reserveProtected: z.boolean(),
    scenarioFeasible: z.boolean(),
    scheduleValidated: z.literal(false),
    backupAutonomyEstablished: z.literal(false),
    physicalDispatchAuthorized: z.literal(false),
  }),
  canonical: z.object({ available: z.literal(false), blockers: z.array(z.string()).min(1) }),
  warnings: z.array(z.string()),
});
