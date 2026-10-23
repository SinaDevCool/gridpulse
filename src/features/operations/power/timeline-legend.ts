import type { OperationsLegendItem } from "../visualization";
import type { EvidenceMode } from "./presentation";

export function timelineLegend(variant: "battery" | "overview" | "compute", mode: EvidenceMode): OperationsLegendItem[] {
  return [
    { label: "Safety target", tone: "target", mark: "dash" },
    { label: "Facility limit", tone: "limit", mark: "dash" },
    ...(variant === "battery" ? [
      { label: "Available discharge", tone: "neutral" as const, mark: "dash" as const },
      { label: "Protected reserve", tone: "target" as const, mark: "area" as const },
    ] : []),
    ...(variant === "overview" ? [{ label: "Baseline import", tone: "demand" as const, mark: "dash" as const }] : []),
    ...(variant === "compute" ? [{ label: "Workload power", tone: "battery" as const }] : []),
    { label: "Facility demand", detail: "MW · planned, before battery", tone: "demand", mark: "area" },
    { label: "Grid import", detail: "MW · after battery", tone: "response" },
    ...(variant === "battery" ? [
      { label: "Battery dispatch", detail: "+ discharge / − charge", tone: "battery" as const, mark: "bar" as const },
      { label: "State of charge", detail: mode === "scenario" ? "% · interval end" : "% · observed", tone: "soc" as const },
    ] : []),
  ];
}
