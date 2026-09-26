import { z } from "zod";
import type { EvidencedValue } from "./evidence";
import { simulateBatteryDispatch } from "./battery-dispatch";

export const operationsScenarioSchema = z
  .object({
    facilityName: z.string().trim().min(1).max(160),
    importLimitMw: z.number().positive().max(5_000),
    safetyReserveMw: z.number().nonnegative().max(1_000),
    pue: z.number().min(1).max(3),
    nonGpuBaseLoadMw: z.number().nonnegative().max(5_000),
    gpuModel: z.string().trim().min(1).max(80),
    gpuCount: z.number().int().positive().max(1_000_000),
    gpuActivePowerWatts: z.number().positive().max(5_000),
    gpuIdlePowerWatts: z.number().nonnegative().max(5_000),
    maximumShiftablePercent: z.number().min(0).max(100),
    maximumDelayMinutes: z.number().int().nonnegative().max(1_440),
    battery: z.object({
      maximumPowerMw: z.number().nonnegative().max(2_000),
      maximumChargePowerMw: z.number().nonnegative().max(2_000),
      usableEnergyMwh: z.number().nonnegative().max(20_000),
      initialSocPercent: z.number().min(0).max(100),
      minimumSocPercent: z.number().min(0).max(100),
      maximumSocPercent: z.number().min(0).max(100),
      chargeEfficiency: z.number().gt(0).max(1),
      dischargeEfficiency: z.number().gt(0).max(1),
      rampRateMwPerMinute: z.number().positive().max(2_000),
      minimumDwellMinutes: z.number().int().nonnegative().max(1_440),
      stateOfHealthPercent: z.number().gt(0).max(100),
      available: z.boolean(),
      inverterAvailable: z.boolean(),
    }),
  })
  .superRefine((value, context) => {
    if (value.safetyReserveMw >= value.importLimitMw) {
      context.addIssue({
        code: "custom",
        path: ["safetyReserveMw"],
        message: "Safety reserve must be below the facility limit.",
      });
    }
    if (value.battery.minimumSocPercent > value.battery.initialSocPercent) {
      context.addIssue({
        code: "custom",
        path: ["battery", "minimumSocPercent"],
        message: "Minimum SOC cannot exceed initial SOC.",
      });
    }
    if (value.battery.initialSocPercent > value.battery.maximumSocPercent) {
      context.addIssue({
        code: "custom",
        path: ["battery", "maximumSocPercent"],
        message: "Maximum SOC cannot be below initial SOC.",
      });
    }
    if (value.gpuIdlePowerWatts > value.gpuActivePowerWatts) {
      context.addIssue({
        code: "custom",
        path: ["gpuIdlePowerWatts"],
        message: "Idle GPU power cannot exceed active GPU power.",
      });
    }
  });

export type OperationsScenario = z.infer<typeof operationsScenarioSchema>;
export type OperationsScenarioKind = "baseline" | "battery" | "battery_workload";

export type OperationsInterval = {
  timestamp: string;
  label: string;
  utilizationPercent: number;
  activeGpuCount: number;
  requestedGpuCount: number;
  gpuPowerMw: number;
  baselineDemandMw: number;
  batteryDemandMw: number;
  combinedDemandMw: number;
  batteryPowerMw: number;
  batterySocPercent: number;
  availableDischargeMw: number;
  availableChargeMw: number;
  batteryShortfallMw: number;
  batteryConstraintCode: string;
  workloadShiftMw: number;
};

export type ScenarioSummary = {
  kind: OperationsScenarioKind;
  label: string;
  peakDemandMw: number;
  violationIntervals: number;
  violationHours: number;
  totalEnergyMwh: number;
  additionalGpuHours: number;
};

export type OperationsOverviewModel = {
  mode: "scenario";
  scenario: OperationsScenario;
  generatedAt: string;
  metrics: {
    facilityDemand: EvidencedValue<number>;
    operationalLimit: EvidencedValue<number>;
    remainingMargin: EvidencedValue<number>;
    additionalGpus: EvidencedValue<number>;
    limitRisk: EvidencedValue<"Low" | "Moderate" | "High">;
  };
  intervals: OperationsInterval[];
  summaries: ScenarioSummary[];
  recommendation: {
    batteryMw: number;
    durationMinutes: number;
    workloadMwh: number;
    violationsAvoided: number;
    peakReductionMw: number;
    additionalGpuHours: number;
  };
};

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export const defaultOperationsScenario: OperationsScenario = {
  facilityName: "100 MW AI Data Centre",
  importLimitMw: 100,
  safetyReserveMw: 2,
  pue: 1.25,
  nonGpuBaseLoadMw: 12,
  gpuModel: "Reference accelerator",
  gpuCount: 125_000,
  gpuActivePowerWatts: 700,
  gpuIdlePowerWatts: 70,
  maximumShiftablePercent: 18,
  maximumDelayMinutes: 120,
  battery: {
    maximumPowerMw: 5,
    maximumChargePowerMw: 5,
    usableEnergyMwh: 80,
    initialSocPercent: 78,
    minimumSocPercent: 20,
    maximumSocPercent: 95,
    chargeEfficiency: 0.95,
    dischargeEfficiency: 0.96,
    rampRateMwPerMinute: 1,
    minimumDwellMinutes: 15,
    stateOfHealthPercent: 96,
    available: true,
    inverterAvailable: true,
  },
};

function workloadUtilization(index: number) {
  const hour = index / 4;
  const morning = 29 * Math.exp(-Math.pow((hour - 8) / 2.15, 2));
  const evening = 34 * Math.exp(-Math.pow((hour - 20.5) / 1.75, 2));
  const daily = 7 * Math.sin(((hour - 5) / 24) * Math.PI * 2);
  return Math.max(30, Math.min(98, 51 + morning + evening + daily));
}

export function buildOperationsScenario(
  raw: OperationsScenario = defaultOperationsScenario,
): OperationsOverviewModel {
  const scenario = operationsScenarioSchema.parse(raw);
  const intervalHours = 0.25;
  const targetMw = scenario.importLimitMw - scenario.safetyReserveMw;
  const baselineIntervals = Array.from({ length: 96 }, (_, index) => {
    const utilizationPercent = workloadUtilization(index);
    const activeGpuCount = Math.round((scenario.gpuCount * utilizationPercent) / 100);
    const requestedGpuCount = Math.min(scenario.gpuCount, Math.round(activeGpuCount * 1.08));
    const gpuPowerMw =
      (activeGpuCount * scenario.gpuActivePowerWatts +
        (scenario.gpuCount - activeGpuCount) * scenario.gpuIdlePowerWatts) /
      1_000_000;
    const baselineDemandMw = scenario.nonGpuBaseLoadMw + gpuPowerMw * scenario.pue;
    const hour = Math.floor(index / 4);
    const minute = (index % 4) * 15;
    return {
      timestamp: new Date(Date.UTC(2026, 8, 26, hour, minute)).toISOString(),
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      utilizationPercent: round(utilizationPercent),
      activeGpuCount,
      requestedGpuCount,
      gpuPowerMw: round(gpuPowerMw, 2),
      baselineDemandMw: round(baselineDemandMw, 2),
    };
  });
  const dispatch = simulateBatteryDispatch(
    baselineIntervals.map((point) => ({
      timestamp: point.timestamp,
      facilityDemandMw: point.baselineDemandMw,
      targetImportMw: targetMw,
    })),
    {
      maximumDischargePowerMw: scenario.battery.maximumPowerMw,
      maximumChargePowerMw: scenario.battery.maximumChargePowerMw,
      usableEnergyMwh: scenario.battery.usableEnergyMwh,
      initialSocPercent: scenario.battery.initialSocPercent,
      minimumSocPercent: scenario.battery.minimumSocPercent,
      maximumSocPercent: scenario.battery.maximumSocPercent,
      chargeEfficiency: scenario.battery.chargeEfficiency,
      dischargeEfficiency: scenario.battery.dischargeEfficiency,
      rampRateMwPerMinute: scenario.battery.rampRateMwPerMinute,
      minimumDwellMinutes: scenario.battery.minimumDwellMinutes,
      stateOfHealthPercent: scenario.battery.stateOfHealthPercent,
      available: scenario.battery.available,
      inverterAvailable: scenario.battery.inverterAvailable,
    },
    15,
  );
  const intervals: OperationsInterval[] = baselineIntervals.map((point, index) => {
    const battery = dispatch[index];
    const batteryDemandMw = battery.gridImportMw;
    const shiftableMw = point.baselineDemandMw * (scenario.maximumShiftablePercent / 100);
    const workloadShiftMw = Math.min(Math.max(0, batteryDemandMw - targetMw), shiftableMw);
    return {
      ...point,
      batteryDemandMw: round(batteryDemandMw, 2),
      combinedDemandMw: round(Math.max(0, batteryDemandMw - workloadShiftMw), 2),
      batteryPowerMw: battery.batteryPowerMw,
      batterySocPercent: battery.socPercent,
      availableDischargeMw: battery.availableDischargeMw,
      availableChargeMw: battery.availableChargeMw,
      batteryShortfallMw: battery.shortfallMw,
      batteryConstraintCode: battery.constraintCode,
      workloadShiftMw: round(workloadShiftMw, 2),
    };
  });

  const summary = (
    kind: OperationsScenarioKind,
    label: string,
    key: "baselineDemandMw" | "batteryDemandMw" | "combinedDemandMw",
  ): ScenarioSummary => {
    const values = intervals.map((point) => point[key]);
    const violations = values.filter((value) => value > scenario.importLimitMw).length;
    const incrementalGpuMw = (scenario.gpuActivePowerWatts * scenario.pue) / 1_000_000;
    const additionalGpuHours =
      kind === "baseline"
        ? 0
        : intervals.reduce((total, point) => {
            const reduction = point.baselineDemandMw - point[key];
            return total + (incrementalGpuMw ? (reduction / incrementalGpuMw) * intervalHours : 0);
          }, 0);
    return {
      kind,
      label,
      peakDemandMw: round(Math.max(...values)),
      violationIntervals: violations,
      violationHours: round(violations * intervalHours, 2),
      totalEnergyMwh: round(values.reduce((sum, value) => sum + value * intervalHours, 0)),
      additionalGpuHours: Math.round(additionalGpuHours),
    };
  };
  const summaries = [
    summary("baseline", "Baseline", "baselineDemandMw"),
    summary("battery", "Battery Response", "batteryDemandMw"),
    summary("battery_workload", "Battery + Workload", "combinedDemandMw"),
  ];
  const baseline = summaries[0];
  const combined = summaries[2];
  const current = intervals.reduce(
    (peak, interval) => (interval.baselineDemandMw > peak.baselineDemandMw ? interval : peak),
    intervals[0],
  );
  const incrementalGpuMw = (scenario.gpuActivePowerWatts * scenario.pue) / 1_000_000;
  const remainingMargin = Math.max(
    0,
    scenario.importLimitMw - scenario.safetyReserveMw - current.combinedDemandMw,
  );
  const additionalGpus = incrementalGpuMw ? Math.floor(remainingMargin / incrementalGpuMw) : 0;
  const risk: "Low" | "Moderate" | "High" =
    baseline.violationIntervals === 0
      ? "Low"
      : combined.violationIntervals === 0
        ? "Moderate"
        : "High";
  const peakReduction = baseline.peakDemandMw - combined.peakDemandMw;
  const dischargeIntervals = intervals.filter((point) => point.batteryPowerMw > 0);
  const shiftedMwh = intervals.reduce(
    (sum, point) => sum + point.workloadShiftMw * intervalHours,
    0,
  );

  return {
    mode: "scenario",
    scenario,
    generatedAt: new Date().toISOString(),
    metrics: {
      facilityDemand: evidenced(current.combinedDemandMw, "MW", "Scenario engine"),
      operationalLimit: {
        value: scenario.importLimitMw,
        unit: "MW",
        evidenceClass: "user_assumption",
        sourceLabel: "Scenario input",
        quality: "accepted",
      },
      remainingMargin: evidenced(
        round(remainingMargin),
        "MW",
        "Limit less reserve and simulated demand",
      ),
      additionalGpus: evidenced(
        additionalGpus,
        undefined,
        "Margin divided by incremental facility power per GPU",
      ),
      limitRisk: evidenced(risk, undefined, "Scenario comparison"),
    },
    intervals,
    summaries,
    recommendation: {
      batteryMw: round(Math.max(0, ...intervals.map((point) => point.batteryPowerMw))),
      durationMinutes: dischargeIntervals.length * 15,
      workloadMwh: round(shiftedMwh),
      violationsAvoided: Math.max(0, baseline.violationIntervals - combined.violationIntervals),
      peakReductionMw: round(peakReduction),
      additionalGpuHours: combined.additionalGpuHours,
    },
  };
}

function evidenced<T>(value: T, unit: string | undefined, sourceLabel: string): EvidencedValue<T> {
  return {
    value,
    unit,
    evidenceClass: "simulated",
    sourceLabel,
    calculatedAt: new Date().toISOString(),
    quality: "accepted",
  };
}
