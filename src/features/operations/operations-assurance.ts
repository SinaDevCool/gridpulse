import { z } from "zod";

export const operationsQualityInputSchema = z.object({
  expectedIntervals: z.number().int().positive(),
  receivedIntervals: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative().default(0),
  staleCount: z.number().int().nonnegative().default(0),
  suspectCount: z.number().int().nonnegative().default(0),
  newestEvidenceAt: z.string().datetime().nullable(),
  assessedAt: z.string().datetime(),
  freshnessThresholdMinutes: z.number().positive().default(15),
  powerBalanceResidualPercent: z.number().nonnegative().nullable().default(null),
});

export function assessOperationsQuality(raw: z.input<typeof operationsQualityInputSchema>) {
  const input = operationsQualityInputSchema.parse(raw);
  const completenessPercent = Math.min(
    100,
    (input.receivedIntervals / input.expectedIntervals) * 100,
  );
  const freshnessMinutes = input.newestEvidenceAt
    ? Math.max(0, (Date.parse(input.assessedAt) - Date.parse(input.newestEvidenceAt)) / 60_000)
    : null;
  const blockers: string[] = [];
  if (completenessPercent < 95) blockers.push("Interval completeness is below 95%.");
  if (freshnessMinutes == null || freshnessMinutes > input.freshnessThresholdMinutes)
    blockers.push("Evidence is missing or stale.");
  if (input.powerBalanceResidualPercent != null && input.powerBalanceResidualPercent > 5)
    blockers.push("Facility power-balance residual exceeds 5%.");
  if (input.suspectCount) blockers.push("Suspect measurements require review.");
  const status =
    blockers.length === 0 ? "ready" : completenessPercent >= 80 ? "limited" : "scenario_only";
  return {
    completenessPercent: Number(completenessPercent.toFixed(1)),
    freshnessMinutes: freshnessMinutes == null ? null : Number(freshnessMinutes.toFixed(1)),
    duplicateCount: input.duplicateCount,
    staleCount: input.staleCount,
    suspectCount: input.suspectCount,
    powerBalanceResidualPercent: input.powerBalanceResidualPercent,
    status,
    blockers,
  } as const;
}

export type VerificationInput = {
  requestedReductionMw: number;
  expectedImportMw: number;
  actualImportMw: number[];
  baselineImportMw: number[];
  intervalMinutes: number;
  batteryPowerMw?: number[];
  reboundImportMw?: number[];
  telemetryCompletenessPercent: number;
};

export function verifyOperationsResponse(input: VerificationInput) {
  if (!input.actualImportMw.length || input.actualImportMw.length !== input.baselineImportMw.length)
    throw new Error("Actual and baseline series must contain matching intervals.");
  const delivered = input.actualImportMw.map((actual, index) =>
    Math.max(0, input.baselineImportMw[index] - actual),
  );
  const deliveredReductionMw = delivered.reduce((sum, value) => sum + value, 0) / delivered.length;
  const deliveredEnergyMwh =
    (delivered.reduce((sum, value) => sum + value, 0) * input.intervalMinutes) / 60;
  const batteryEnergyMwh =
    ((input.batteryPowerMw ?? []).reduce((sum, value) => sum + Math.max(0, value), 0) *
      input.intervalMinutes) /
    60;
  const reboundEnergyMwh =
    ((input.reboundImportMw ?? []).reduce(
      (sum, value, index) => sum + Math.max(0, value - (input.baselineImportMw[index] ?? value)),
      0,
    ) *
      input.intervalMinutes) /
    60;
  const netDeliveredEnergyMwh = Math.max(0, deliveredEnergyMwh - reboundEnergyMwh);
  const confidence =
    input.telemetryCompletenessPercent >= 95
      ? "high"
      : input.telemetryCompletenessPercent >= 80
        ? "medium"
        : "low";
  return {
    requestedReductionMw: input.requestedReductionMw,
    deliveredReductionMw: Number(deliveredReductionMw.toFixed(3)),
    deliveredEnergyMwh: Number(deliveredEnergyMwh.toFixed(3)),
    batteryEnergyMwh: Number(batteryEnergyMwh.toFixed(3)),
    reboundEnergyMwh: Number(reboundEnergyMwh.toFixed(3)),
    netDeliveredEnergyMwh: Number(netDeliveredEnergyMwh.toFixed(3)),
    performancePercent: Number(
      Math.min(
        100,
        input.requestedReductionMw
          ? (deliveredReductionMw / input.requestedReductionMw) * 100
          : 100,
      ).toFixed(1),
    ),
    verified: confidence !== "low",
    confidence,
  } as const;
}

export function assessOperationsCompliance(input: {
  facilityEnergyMwh: number | null;
  itEnergyMwh: number | null;
  renewableSharePercent: number | null;
  wasteHeatMwh: number | null;
  heatTemperatureC: number | null;
  measurementCoveragePercent: number;
}) {
  const measuredPue =
    input.facilityEnergyMwh != null && input.itEnergyMwh != null && input.itEnergyMwh > 0
      ? input.facilityEnergyMwh / input.itEnergyMwh
      : null;
  const missing: string[] = [];
  if (measuredPue == null) missing.push("Aligned facility and IT energy");
  if (input.renewableSharePercent == null) missing.push("Renewable electricity share");
  if (input.wasteHeatMwh == null) missing.push("Waste-heat quantity");
  if (input.heatTemperatureC == null) missing.push("Waste-heat temperature");
  if (input.measurementCoveragePercent < 95) missing.push("At least 95% measurement coverage");
  return {
    measuredPue: measuredPue == null ? null : Number(measuredPue.toFixed(3)),
    evidenceReady: missing.length === 0,
    missing,
  };
}

export function evaluateResponseEconomics(input: {
  avoidedPeakMw: number;
  durationHours: number;
  energyPriceEurPerMwh: number;
  capacityValueEurPerMw: number;
  batteryEnergyMwh: number;
  batteryDegradationEurPerMwh: number;
  shiftedEnergyMwh: number;
  workloadCostEurPerMwh: number;
  flexibilityPaymentEur: number;
  slaPenaltyEur: number;
  baselineImportMw?: number[];
  proposedImportMw?: number[];
  intervalHours?: number[];
  intervalPricesEurPerMwh?: number[];
  billingPeakEvidenceReviewed?: boolean;
}) {
  const baseline = input.baselineImportMw;
  const proposed = input.proposedImportMw;
  const durations = input.intervalHours;
  const prices = input.intervalPricesEurPerMwh;
  const comparable = Boolean(
    baseline?.length &&
    proposed?.length === baseline.length &&
    durations?.length === baseline.length &&
    prices?.length === baseline.length,
  );
  if (!comparable)
    return {
      available: false,
      reason:
        "Aligned full-horizon baseline, recovery/recharge imports, durations and tariff prices are required.",
      avoidedEnergyCostEur: null,
      avoidedCapacityCostEur: null,
      batteryCostEur: null,
      workloadCostEur: null,
      grossValueEur: null,
      netValueEur: null,
    };
  const avoidedEnergyCostEur = baseline!.reduce(
    (sum, value, index) => sum + (value - proposed![index]) * durations![index] * prices![index],
    0,
  );
  const avoidedCapacityCostEur = input.billingPeakEvidenceReviewed
    ? input.avoidedPeakMw * input.capacityValueEurPerMw
    : 0;
  const batteryCostEur = input.batteryEnergyMwh * input.batteryDegradationEurPerMwh;
  const workloadCostEur = input.shiftedEnergyMwh * input.workloadCostEurPerMwh;
  const grossValueEur = avoidedEnergyCostEur + avoidedCapacityCostEur + input.flexibilityPaymentEur;
  return {
    available: true,
    reason: input.billingPeakEvidenceReviewed
      ? "Reviewed full-horizon tariff comparison."
      : "Full-horizon energy comparison; demand-charge savings excluded without reviewed billing evidence.",
    avoidedEnergyCostEur: Number(avoidedEnergyCostEur.toFixed(2)),
    avoidedCapacityCostEur: Number(avoidedCapacityCostEur.toFixed(2)),
    batteryCostEur: Number(batteryCostEur.toFixed(2)),
    workloadCostEur: Number(workloadCostEur.toFixed(2)),
    grossValueEur: Number(grossValueEur.toFixed(2)),
    netValueEur: Number(
      (grossValueEur - batteryCostEur - workloadCostEur - input.slaPenaltyEur).toFixed(2),
    ),
  };
}

export function authorizeDispatch(input: {
  mode: "scenario" | "historical" | "shadow" | "live";
  evidenceReady: boolean;
  connectorHealthy: boolean;
  agreementCurrent: boolean;
  approvalCount: number;
  requiredApprovalCount?: number;
  automaticDispatchEnabled: boolean;
}) {
  const reasons: string[] = [];
  if (input.mode !== "live") reasons.push("The workspace is not in live mode.");
  if (!input.evidenceReady) reasons.push("Operational evidence is not ready.");
  if (!input.connectorHealthy) reasons.push("A required connector is unhealthy.");
  if (!input.agreementCurrent) reasons.push("The operating agreement is not current.");
  if (input.approvalCount < (input.requiredApprovalCount ?? 2))
    reasons.push("Two-person approval is incomplete.");
  if (!input.automaticDispatchEnabled) reasons.push("Automatic dispatch is disabled.");
  return { authorized: reasons.length === 0, failClosed: true, reasons };
}
