import { Building2,FileText,Gauge,Gavel,Map,RadioTower } from "lucide-react";

export const tabs = [
  "overview",
  "qualification",
  "grid",
  "evidence",
  "operator",
  "decision",
] as const;

export type Tab = (typeof tabs)[number];

export const tabDetails: Record<Tab, { label: string; hint: string; icon: typeof Gauge }> = {
  overview: { label: "Overview", hint: "Property brief", icon: Building2 },
  qualification: { label: "Site Checks", hint: "Development review", icon: Gauge },
  grid: { label: "Power Options", hint: "Connection hypotheses", icon: Map },
  evidence: { label: "Sources", hint: "Evidence & documents", icon: FileText },
  operator: { label: "Enquiries", hint: "External engagement", icon: RadioTower },
  decision: { label: "Decision", hint: "Advance, hold or reject", icon: Gavel },
};

export function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
