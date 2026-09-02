export const GRID_VOLTAGE_CLASSES = [
  { id: "ehv", label: "380 kV and above", color: "#c084fc", minimumKv: 380 },
  { id: "220kv", label: "220–<380 kV", color: "#3b82f6", minimumKv: 220 },
  { id: "110kv", label: "110–<220 kV", color: "#38bdf8", minimumKv: 110 },
  { id: "distribution", label: "Below 110 kV", color: "#2dd4bf", minimumKv: 0.001 },
  { id: "unknown", label: "Voltage not mapped", color: "#64748b", minimumKv: 0 },
] as const;

export type GridVoltageClassId = (typeof GRID_VOLTAGE_CLASSES)[number]["id"];

export function classifyGridVoltage(maxVoltageKv: number | null | undefined) {
  const value = Number.isFinite(maxVoltageKv) ? Number(maxVoltageKv) : 0;
  return (
    GRID_VOLTAGE_CLASSES.find((item) => value >= item.minimumKv) ?? GRID_VOLTAGE_CLASSES.at(-1)!
  );
}

export function voltageColorExpression(property = "max_voltage_kv"): ExpressionSpecification {
  return [
    "step",
    ["number", ["get", property], 0],
    "#64748b",
    0.001,
    "#2dd4bf",
    110,
    "#38bdf8",
    220,
    "#3b82f6",
    380,
    "#c084fc",
  ];
}

export function voltageWidthExpression(property = "max_voltage_kv"): ExpressionSpecification {
  return ["step", ["number", ["get", property], 0], 1, 0.001, 1.2, 110, 1.8, 220, 2.4, 380, 3];
}

export function voltageClassFilter(
  voltageClass: GridVoltageClassId | null,
  property = "max_voltage_kv",
): ExpressionSpecification | null {
  if (!voltageClass) return null;
  const value: ExpressionSpecification = ["number", ["get", property], 0];
  switch (voltageClass) {
    case "ehv":
      return [">=", value, 380];
    case "220kv":
      return ["all", [">=", value, 220], ["<", value, 380]];
    case "110kv":
      return ["all", [">=", value, 110], ["<", value, 220]];
    case "distribution":
      return ["all", [">", value, 0], ["<", value, 110]];
    case "unknown":
      return ["<=", value, 0];
  }
}
import type { ExpressionSpecification } from "maplibre-gl";
