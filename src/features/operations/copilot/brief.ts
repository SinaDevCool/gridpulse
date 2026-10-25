import { formatMw, formatMwh, formatPercent } from "../formatting";
import { formatOperationsInterval, formatOperationsTime } from "../presentation";
import { BRIEF_VERSION, briefSchema, selectionSchema, sectionLabels, type BriefFact, type PlanBrief } from "./contracts";
import type { BriefEvidence } from "./evidence";
export { buildBriefEvidence, type BriefEvidence } from "./evidence";
export { BRIEF_VERSION, briefRequestSchema, briefSchema, selectionSchema, sectionLabels, type PlanBrief } from "./contracts";

export function formatBriefFact(fact: BriefFact): string {
  if (fact.availability !== "available") return fact.availability === "not_applicable" ? "Not applicable" : "Unavailable";
  if (typeof fact.value === "boolean") return fact.value ? "Yes" : "No";
  if (typeof fact.value !== "number") {
    const range = fact.value.split(" – ");
    if (range.length === 2 && range.every(value => /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))))
      return formatOperationsInterval(range[0], range[1]);
    if (/^\d{4}-\d{2}-\d{2}T/.test(fact.value) && Number.isFinite(Date.parse(fact.value)))
      return formatOperationsTime(fact.value, true);
    return fact.value;
  }
  switch (fact.unit) {
    case "MW": return formatMw(fact.value);
    case "MWh AC": return `${formatMwh(fact.value)} AC`;
    case "MWh DC": return `${formatMwh(fact.value)} DC`;
    case "%": return formatPercent(fact.value);
    case "count": return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(fact.value);
    default: return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(fact.value)} ${fact.unit}`;
  }
}

type Claim = { id: string; claimType: string; section: PlanBrief["findings"][number]["section"];
  text: string; factIds: string[]; mandatory: boolean };
/** Eligible claims are constructed from full-precision accepted facts before model selection. */
export function eligibleBriefClaims(e: BriefEvidence): Claim[] {
  const byId = new Map(e.facts.map(fact => [fact.id, fact]));
  const get = (id: string) => { const value = byId.get(id); if (!value) throw new Error("Missing evidence fact"); return value; };
  const formatted = (id: string) => formatBriefFact(get(id));
  const claims: Claim[] = [];
  const add = (id: string, section: Claim["section"], factIds: string[], text: string, mandatory = false) => {
    factIds.forEach(get); claims.push({ id, claimType: id, section, factIds, text, mandatory });
  };
  add("solver", "summary", ["solver.status"], e.identity.status === "optimal"
    ? "The solver reported optimal within the submitted model; physical replay passed."
    : "The solver returned a feasible plan, not proven optimal; physical replay passed.", true);
  add("peak", "power", ["power.baseline_peak", "power.plan_peak"],
    `Modelled peak import: ${formatted("power.baseline_peak")} baseline; ${formatted("power.plan_peak")} joint plan. Peaks may occur at different times.`, true);
  add("limit", "power", ["power.breach_minutes", "power.limit"],
    `Time above the ${formatted("power.limit")} facility limit: ${formatted("power.breach_minutes")} across the full horizon.`);
  add("operating_margins", "power", ["power.safety_margin", "power.facility_margin"],
    `Whole-plan operating margins: ${formatted("power.safety_margin")} to the safety target; ${formatted("power.facility_margin")} to the facility limit. These are not additional connection capacity.`);
  const peak = get("power.plan_peak"), target = get("power.target");
  const outcome = get("power.target_met");
  if (peak.availability === "available" && target.availability === "available" && outcome.availability === "available" && typeof outcome.value === "boolean") {
    const met = outcome.value;
    add(met ? "target_met" : "target_unmet", "power", [peak.id, target.id, outcome.id],
      `Safety target ${met ? "met" : "not met"} within model: peak ${formatted(peak.id)}; target ${formatted(target.id)}.`);
  }
  for (const check of e.checks) {
    if (check.id === "completion" && check.state === "passed") continue;
    const fact = get(`check.${check.id}`);
    add(`check_${check.id}`, check.id === "terminal" ? "battery" : "workloads", [fact.id],
      `${fact.label}: ${formatted(fact.id)}.`, check.state === "failed" || check.state === "unavailable" || check.id === "terminal");
  }
  const jobFacts = e.facts.filter(fact => fact.id.startsWith("workload."));
  add("workload_outcome", "workloads", ["check.completion", "workloads.completed", "workloads.total", "workloads.remaining", "workloads.deadlines_met", "workloads.deadlines_missing", ...jobFacts.map(fact => fact.id)],
    `Completion: ${formatted("workloads.completed")} of ${formatted("workloads.total")}; remaining work ${formatted("workloads.remaining")}. Deadline checks met: ${formatted("workloads.deadlines_met")}; unavailable: ${formatted("workloads.deadlines_missing")}.`, true);
  const present = get("battery.present");
  if (present.availability === "available" && present.value === true) {
    add("battery_reserve", "battery", ["battery.minimum_soc", "battery.reserve_soc", "battery.reserve_protected"],
      `Minimum modelled SOC ${formatted("battery.minimum_soc")}; protected reserve ${formatted("battery.reserve_soc")}; reserve protected: ${formatted("battery.reserve_protected")}.`, true);
    add("battery_energy", "battery", ["battery.ac_discharge", "battery.terminal_energy", "battery.terminal_target"],
      `Delivered energy ${formatted("battery.ac_discharge")}; terminal stored energy ${formatted("battery.terminal_energy")}; terminal target ${formatted("battery.terminal_target")}.`);
  } else add("no_battery", "battery", ["battery.present"], "No battery is included in this assessment; battery energy and SOC checks are not applicable.", true);
  return claims;
}

const actions = { review_workloads: "Review workload completion and deadline checks in Compute & Workloads.",
  review_battery: "Review battery reserve and terminal energy in Power & Battery.",
  review_inputs: "Confirm the submitted assumptions and evidence gaps before making a decision." };
export function eligibleBriefActions(evidence: BriefEvidence) {
  return Object.keys(actions).filter(id => id !== "review_battery" ||
    evidence.facts.some(fact => fact.id === "battery.present" && fact.value === true));
}
export function renderPlanBrief(raw: unknown, evidence: BriefEvidence, model: string,
  provider: { responseId?: string; usage?: { inputTokens: number; outputTokens: number } } = {}): PlanBrief {
  const selected = selectionSchema.parse(raw);
  if (new Set(selected.findings).size !== selected.findings.length || new Set(selected.actions).size !== selected.actions.length)
    throw new Error("Duplicate brief references");
  const eligible = eligibleBriefClaims(evidence);
  const byId = new Map(eligible.map(claim => [claim.id, claim]));
  if (selected.findings.some(id => !byId.has(id))) throw new Error("Unknown or inapplicable claim");
  if (selected.actions.some(id => !eligibleBriefActions(evidence).includes(id))) throw new Error("Inapplicable review action");
  const ids = [...new Set([...eligible.filter(claim => claim.mandatory).map(claim => claim.id), ...selected.findings])];
  if (ids.length > 12) throw new Error("Brief exceeds the final finding limit");
  const findings = ids.map(id => { const { mandatory: _, ...finding } = byId.get(id)!; return finding; });
  const referenced = new Set(findings.flatMap(finding => finding.factIds));
  return briefSchema.parse({ version: BRIEF_VERSION, resultFingerprint: evidence.identity.resultFingerprint,
    generatedAt: new Date().toISOString(), model, findings, evidence: evidence.facts.filter(fact => referenced.has(fact.id)),
    receipt: { ...evidence.receipt, providerResponseId: provider.responseId ?? null, usage: provider.usage ?? null },
    actions: selected.actions.map(id => actions[id]), limitations: evidence.limitations });
}

export function briefText(brief: PlanBrief, reviewedAt?: string) {
  const sections = Object.entries(sectionLabels).flatMap(([id, label]) => [label,
    ...brief.findings.filter(finding => finding.section === id).map(finding => `${finding.text} [${finding.factIds.join(", ")}]`), ""]);
  return ["GridPulse plan brief — model assessment, no dispatch authorisation", `Assessment: ${brief.resultFingerprint}`,
    `Generated: ${brief.generatedAt} · ${brief.model}`, `Human review: ${reviewedAt ?? "Not acknowledged"}`,
    "Review acknowledgement is not operational approval.", "", ...sections, "Review next", ...brief.actions,
    "", "Evidence", ...brief.evidence.map(fact => `[${fact.id}] ${fact.label}: ${formatBriefFact(fact)} · raw ${JSON.stringify(fact.value)} ${fact.unit} · ${fact.scope} · ${fact.availability} · ${fact.source.selector}.${fact.source.field}`),
    "", "Limitations", ...brief.limitations, "", "Generation receipt", JSON.stringify(brief.receipt, null, 2)].join("\n");
}
