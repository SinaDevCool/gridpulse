import { operationsScenarioSchema, type OperationsScenario } from "../scenario-engine";

export const fields = {
  batteryEnergy: { label: "Battery nominal energy (MWh)", unit: "MWh" },
  batteryPower: { label: "Battery discharge limit (MW)", unit: "MW" },
  importLimit: { label: "Facility import limit (MW)", unit: "MW" },
} as const;
export type Field = keyof typeof fields;
export function alternativeScenario(original: OperationsScenario, field: Field, value: number) {
  return operationsScenarioSchema.parse({ ...original,
    ...(field === "importLimit" ? { importLimitMw: value } : { battery: { ...original.battery,
      ...(field === "batteryEnergy" ? { usableEnergyMwh: value } : { maximumPowerMw: value }) } }) });
}
