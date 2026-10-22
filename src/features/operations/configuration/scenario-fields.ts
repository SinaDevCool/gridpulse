import type { OperationsScenario } from "../scenario-engine";
export const scenarioFieldGroups = [
  {
    title: "Facility limits",
    open: true,
    fields: [
      ["importLimitMw", "Facility Limit", "MW"],
      ["safetyReserveMw", "Safety Reserve", "MW"],
    ],
  },
  {
    title: "Battery",
    fields: [
      ["battery.maximumPowerMw", "Battery Power", "MW"],
      ["battery.maximumChargePowerMw", "Maximum Charge Power", "MW"],
      ["battery.usableEnergyMwh", "Battery Energy (before health/SOC derating)", "MWh"],
      ["battery.initialSocPercent", "Initial SOC", "%"],
      ["battery.minimumSocPercent", "Minimum Reserve SOC", "%"],
    ],
  },
  {
    title: "Battery advanced",
    fields: [
      ["battery.maximumSocPercent", "Maximum SOC", "%"],
      ["battery.stateOfHealthPercent", "Battery Health", "%"],
      ["battery.chargeEfficiency", "Charge Efficiency", "ratio"],
      ["battery.dischargeEfficiency", "Discharge Efficiency", "ratio"],
      ["battery.rampRateMwPerMinute", "Ramp Rate", "MW/min"],
      ["battery.minimumDwellMinutes", "Minimum Dwell", "min"],
      ["battery.criticalLoadMw", "Critical Backup Load (assumption)", "MW"],
      ["battery.backupAutonomyMinutes", "Required Backup Duration (assumption)", "min"],
    ],
  },
  {
    title: "Compute & flexibility",
    fields: [
      ["gpuCount", "GPU Count", "GPUs"],
      ["gpuActivePowerWatts", "GPU Active Power", "W"],
      ["gpuIdlePowerWatts", "GPU Idle Power", "W"],
      ["maximumShiftablePercent", "Shiftable Workload", "%"],
      ["maximumDelayMinutes", "Maximum Delay", "min"],
    ],
  },
  {
    title: "Facility assumptions",
    fields: [
      ["pue", "PUE", "ratio"],
      ["nonGpuBaseLoadMw", "Other Facility Load (excludes GPU overhead)", "MW"],
    ],
  },
] as const;
export function scenarioFieldId(path: string) {
  return `ops-${path.replaceAll(".", "-")}`;
}
export function readScenarioField(scenario: OperationsScenario, path: string): number {
  const [key, child] = path.split(".");
  return Number(
    child
      ? scenario.battery[child as keyof OperationsScenario["battery"]]
      : scenario[key as keyof OperationsScenario],
  );
}
export function updateScenarioField(
  scenario: OperationsScenario,
  path: string,
  value: number,
): OperationsScenario {
  const [key, child] = path.split(".");
  return child
    ? { ...scenario, battery: { ...scenario.battery, [child]: value } }
    : { ...scenario, [key]: value };
}
