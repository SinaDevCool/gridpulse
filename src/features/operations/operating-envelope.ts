import { z } from "zod";

export const operationsEvidenceClassSchema = z.enum([
  "measured",
  "operator_confirmed",
  "contract_reviewed",
  "customer_declared",
  "derived",
  "forecast",
  "reference",
  "simulated",
  "unavailable",
]);

export type OperationsEvidenceClass = z.infer<typeof operationsEvidenceClassSchema>;

export const operatingEnvelopeIntervalSchema = z.object({
  timestamp: z.string().datetime(),
  durationMinutes: z.number().positive().max(1_440).default(15),
  baselineDemandMw: z.number().nonnegative(),
  proposedDemandMw: z.number().nonnegative().optional(),
  contractualLimitMw: z.number().positive(),
  operatorLimitMw: z.number().positive().nullable().default(null),
  transformerLimitMw: z.number().positive().nullable().default(null),
  upsLimitMw: z.number().positive().nullable().default(null),
  coolingLimitMw: z.number().positive().nullable().default(null),
  safetyReserveMw: z.number().nonnegative().default(0),
  demandUncertaintyMw: z.number().nonnegative().default(0),
  resourceUncertaintyMw: z.number().nonnegative().default(0),
  batteryAvailablePowerMw: z.number().nonnegative().default(0),
  batteryAvailableEnergyMwh: z.number().nonnegative().default(0),
  batteryDischargeEfficiency: z.number().gt(0).max(1).default(1),
  workloadFlexibleMw: z.number().nonnegative().default(0),
  workloadReboundMw: z.number().nonnegative().default(0),
});

export type OperatingEnvelopeIntervalInput = z.input<typeof operatingEnvelopeIntervalSchema>;
type ParsedOperatingEnvelopeInterval = z.output<typeof operatingEnvelopeIntervalSchema>;
export type OperatingConstraintCode =
  | "operator_limit"
  | "contractual_limit"
  | "transformer_limit"
  | "ups_limit"
  | "cooling_limit";

export type OperatingEnvelopeInterval = ParsedOperatingEnvelopeInterval & {
  technicalLimitMw: number;
  directCeilingMw: number;
  batteryCeilingMw: number;
  combinedCeilingMw: number;
  riskAdjustedCeilingMw: number;
  directHeadroomMw: number;
  batteryResponseMw: number;
  workloadResponseMw: number;
  residualShortfallMw: number;
  feasibleBand: "direct" | "battery" | "battery_workload" | "infeasible";
  bindingConstraint: OperatingConstraintCode;
  confidence: "high" | "medium" | "low";
};

const round = (value: number) => Number(value.toFixed(3));

export function calculateOperatingEnvelope(
  rawIntervals: OperatingEnvelopeIntervalInput[],
): OperatingEnvelopeInterval[] {
  return rawIntervals.map((raw) => {
    const interval = operatingEnvelopeIntervalSchema.parse(raw);
    const limits: Array<[OperatingConstraintCode, number]> = [
      ["contractual_limit", interval.contractualLimitMw],
      ...(interval.operatorLimitMw == null
        ? []
        : [["operator_limit", interval.operatorLimitMw] as [OperatingConstraintCode, number]]),
      ...(interval.transformerLimitMw == null
        ? []
        : [["transformer_limit", interval.transformerLimitMw] as [OperatingConstraintCode, number]]),
      ...(interval.upsLimitMw == null
        ? []
        : [["ups_limit", interval.upsLimitMw] as [OperatingConstraintCode, number]]),
      ...(interval.coolingLimitMw == null
        ? []
        : [["cooling_limit", interval.coolingLimitMw] as [OperatingConstraintCode, number]]),
    ];
    const [bindingConstraint, technicalLimitMw] = limits.reduce((lowest, candidate) =>
      candidate[1] < lowest[1] ? candidate : lowest,
    );
    const directCeilingMw = Math.max(0, technicalLimitMw - interval.safetyReserveMw);
    const energyLimitedBatteryMw =
      (interval.batteryAvailableEnergyMwh * interval.batteryDischargeEfficiency) /
      (interval.durationMinutes / 60);
    const batteryResponseMw = Math.min(
      interval.batteryAvailablePowerMw,
      energyLimitedBatteryMw,
    );
    const batteryCeilingMw = directCeilingMw + batteryResponseMw;
    const combinedCeilingMw = Math.max(
      batteryCeilingMw,
      batteryCeilingMw + interval.workloadFlexibleMw - interval.workloadReboundMw,
    );
    const uncertaintyMw = interval.demandUncertaintyMw + interval.resourceUncertaintyMw;
    const riskAdjustedCeilingMw = Math.max(0, combinedCeilingMw - uncertaintyMw);
    const proposedDemandMw = interval.proposedDemandMw ?? interval.baselineDemandMw;
    const directHeadroomMw = directCeilingMw - interval.baselineDemandMw;
    const requiredResponseMw = Math.max(0, proposedDemandMw - directCeilingMw);
    const usedBatteryMw = Math.min(requiredResponseMw, batteryResponseMw);
    const workloadResponseMw = Math.min(
      Math.max(0, requiredResponseMw - usedBatteryMw),
      interval.workloadFlexibleMw,
    );
    const residualShortfallMw = Math.max(
      0,
      proposedDemandMw + interval.workloadReboundMw - directCeilingMw - usedBatteryMw - workloadResponseMw,
    );
    const feasibleBand =
      proposedDemandMw <= directCeilingMw
        ? "direct"
        : proposedDemandMw <= batteryCeilingMw
          ? "battery"
          : proposedDemandMw <= combinedCeilingMw
            ? "battery_workload"
            : "infeasible";
    const confidence = uncertaintyMw === 0 ? "high" : uncertaintyMw <= technicalLimitMw * 0.05 ? "medium" : "low";
    return {
      ...interval,
      technicalLimitMw: round(technicalLimitMw),
      directCeilingMw: round(directCeilingMw),
      batteryCeilingMw: round(batteryCeilingMw),
      combinedCeilingMw: round(combinedCeilingMw),
      riskAdjustedCeilingMw: round(riskAdjustedCeilingMw),
      directHeadroomMw: round(directHeadroomMw),
      batteryResponseMw: round(usedBatteryMw),
      workloadResponseMw: round(workloadResponseMw),
      residualShortfallMw: round(residualShortfallMw),
      feasibleBand,
      bindingConstraint,
      confidence,
    };
  });
}

export function summarizeOperatingEnvelope(intervals: OperatingEnvelopeInterval[]) {
  const lowest = intervals.reduce((current, interval) =>
    interval.riskAdjustedCeilingMw < current.riskAdjustedCeilingMw ? interval : current,
  );
  return {
    intervalCount: intervals.length,
    minimumDirectCeilingMw: round(Math.min(...intervals.map((item) => item.directCeilingMw))),
    minimumRiskAdjustedCeilingMw: round(
      Math.min(...intervals.map((item) => item.riskAdjustedCeilingMw)),
    ),
    infeasibleIntervals: intervals.filter((item) => item.feasibleBand === "infeasible").length,
    bindingConstraint: lowest.bindingConstraint,
    confidence: intervals.some((item) => item.confidence === "low")
      ? "low"
      : intervals.some((item) => item.confidence === "medium")
        ? "medium"
        : "high",
  } as const;
}
