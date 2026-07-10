// Enterprise European region taxonomy used across Markets, Analytics, and
// Regions dashboards. Non-European projects are excluded from these views
// so the €400/yr subscriber experience stays focused on the EU/UK market.
import type { Project } from "@/lib/gridpulse-data";

export type EuRegion =
  | "Germany (DE)"
  | "United Kingdom (UK)"
  | "Rest of Europe (EU)";

export const EU_REGIONS: EuRegion[] = [
  "Germany (DE)",
  "United Kingdom (UK)",
  "Rest of Europe (EU)",
];

// Countries considered part of "Rest of Europe (EU)" (plus Germany + UK
// which get their own dedicated buckets).
const REST_OF_EUROPE_CC = new Set([
  "FR","ES","IT","NL","BE","PL","PT","IE","SE","DK","FI","AT","CZ",
  "GR","HU","RO","BG","HR","SI","SK","LT","LV","EE","LU","MT","CY",
  "NO","CH","IS",
]);

function normaliseCc(p: Project): string {
  return (p.countryCode ?? "").toUpperCase();
}

export function euRegionOf(p: Project): EuRegion | null {
  const cc = normaliseCc(p);
  if (cc === "DE") return "Germany (DE)";
  if (cc === "GB" || cc === "UK") return "United Kingdom (UK)";
  if (REST_OF_EUROPE_CC.has(cc)) return "Rest of Europe (EU)";

  // Legacy free-text fallbacks — some rows only carry the region string.
  const r = (p.region ?? "").toLowerCase();
  if (r.includes("german")) return "Germany (DE)";
  if (r.includes("united kingdom") || r === "uk") return "United Kingdom (UK)";
  if (r.includes("europe") || r === "eu" || r === "emea") return "Rest of Europe (EU)";
  return null;
}

export function isEuropeanProject(p: Project): boolean {
  return euRegionOf(p) !== null;
}
