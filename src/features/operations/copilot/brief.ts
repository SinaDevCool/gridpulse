import { z } from "zod";
import type { CanonicalPresentation } from "../canonical-presentation";
import { canonicalBreachMinutes, canonicalCheckSummary } from "../canonical-overview";

export const briefRequestSchema = z.object({ jobId: z.string().uuid(),
  resultFingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const selectionSchema = z.object({ findings: z.array(z.string()).min(1).max(8),
  actions: z.array(z.enum(["review_workloads", "review_battery", "review_inputs"])).min(1).max(3) }).strict();
export type BriefEvidence = ReturnType<typeof buildBriefEvidence>;
export const briefSchema = z.object({ version: z.literal("operations-brief-v1"),
  resultFingerprint: z.string(), generatedAt: z.string(), model: z.string(),
  findings: z.array(z.object({ id: z.string(), text: z.string() })),
  actions: z.array(z.string()), limitations: z.array(z.string()) });
export type PlanBrief = z.infer<typeof briefSchema>;

/** Reuse accepted presentation facts. The provider can select IDs, never author numbers or claims. */
export function buildBriefEvidence(a: CanonicalPresentation) {
  const checks = canonicalCheckSummary(a);
  const facts = [
    { id: "peak", text: `Modelled peak import: ${a.baselinePeakMw.toFixed(1)} MW baseline; ${a.planPeakMw.toFixed(1)} MW joint plan. Peaks may occur at different times.` },
    { id: "limit", text: `Time above the ${a.limitMw.toFixed(1)} MW facility limit: ${canonicalBreachMinutes(a, false)} minutes across the full horizon.` },
    { id: "target", text: `Safety target: ${a.targetMw.toFixed(1)} MW; peak margin: ${(a.targetMw - a.planPeakMw).toFixed(1)} MW.` },
    ...checks.checks.map(check => ({ id: `check_${check.id}`, text: `${check.label}: ${check.value}.` })),
    { id: "solver", text: a.projected.identity.status === "optimal"
      ? "The solver reported optimal within the submitted model; physical replay passed."
      : "The solver returned a feasible plan, not proven optimal; physical replay passed." },
  ];
  return { identity: a.projected.identity, scope: "full planning horizon", facts,
    required: ["solver", ...checks.checks.filter(check => check.state === "failed" || check.state === "unavailable").map(check => `check_${check.id}`)],
    limitations: ["Synthetic model; not measured delivery, a live forecast or equipment control.",
      "Additional connection capacity and causal binding constraints are not assessed.",
      "Review the submitted inputs and model checks before using this brief for a decision."] };
}

const actions = { review_workloads: "Review workload completion and deadline checks in Compute & Workloads.",
  review_battery: "Review battery reserve and terminal energy in Power & Battery.",
  review_inputs: "Confirm the submitted assumptions and evidence gaps before making a decision." };

export function renderPlanBrief(raw: unknown, evidence: BriefEvidence, model: string): PlanBrief {
  const selection = selectionSchema.parse(raw);
  if (new Set(selection.findings).size !== selection.findings.length || new Set(selection.actions).size !== selection.actions.length)
    throw new Error("Duplicate brief references");
  const byId = new Map(evidence.facts.map(fact => [fact.id, fact]));
  if (selection.findings.some(id => !byId.has(id))) throw new Error("Unknown brief reference");
  // Mandatory warnings cannot be omitted by the model.
  const ids = [...new Set([...evidence.required, ...selection.findings])];
  return { version: "operations-brief-v1", resultFingerprint: evidence.identity.resultFingerprint,
    generatedAt: new Date().toISOString(), model, findings: ids.map(id => byId.get(id)!),
    actions: selection.actions.map(id => actions[id]), limitations: evidence.limitations };
}

export function briefText(brief: PlanBrief) {
  return ["GridPulse plan brief — human review required", `Assessment: ${brief.resultFingerprint}`,
    `Generated: ${brief.generatedAt} · ${brief.model}`, "", ...brief.findings.map(fact => `${fact.text} [${fact.id}]`),
    "", ...brief.actions, "", ...brief.limitations].join("\n");
}
