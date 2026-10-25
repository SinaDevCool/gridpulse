import type { OperationsLegendItem } from "../visualization";
import type { EvidenceMode } from "./presentation";

export function timelineLegend(variant: "battery" | "overview", mode: EvidenceMode): OperationsLegendItem[] {
  return [
    { label: "Safety target", tone: "target", mark: "dash" },
    { label: "Facility limit", tone: "limit", mark: "dash" },
    ...(variant === "battery" ? [
      { label: "Available discharge", tone: "neutral" as const, mark: "dash" as const },
      { label: "Protected reserve", tone: "target" as const, mark: "area" as const },
    ] : []),
    ...(variant === "overview" ? [{ label: "Baseline import", tone: "demand" as const, mark: "dash" as const }] : []),
    { label: "Facility demand", detail: "MW · before battery", tone: "demand", mark: "area" },
    { label: "Grid import", detail: "MW · after battery", tone: "response" },
    ...(variant === "battery" ? [
      { label: "Battery dispatch", detail: "+ discharge / − charge", tone: "battery" as const, mark: "bar" as const },
      { label: "State of charge", detail: mode === "scenario" ? "% · interval end" : "% · observed", tone: "soc" as const },
    ] : []),
  ];
}

/** One visibility store, with controls located beside their corresponding panel. */
export function batteryPanelLegend(panel: "facility" | "dispatch" | "soc", available: boolean): OperationsLegendItem[] {
  const items = timelineLegend("battery", "scenario");
  const labels = panel === "facility" ? ["Facility demand", "Grid import", "Safety target", "Facility limit"] :
    panel === "dispatch" ? ["Battery dispatch", ...(available ? ["Available discharge"] : [])] : ["State of charge", "Protected reserve"];
  return labels.map(label => items.find(item => item.label === label)!).map(item => item.label === "Facility demand"
    ? { ...item, id: item.label, label: "Before battery", mark: "dash" as const, detail: "MW" }
    : item.label === "State of charge" ? { ...item, detail: "% · boundary states" } : item);
}
