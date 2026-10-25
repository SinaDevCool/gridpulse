import { z } from "zod";

export const BRIEF_VERSION = "operations-brief-v2" as const;
export const EVIDENCE_VERSION = "operations-evidence-v2" as const;
export const PROMPT_VERSION = "approved-findings-v2" as const;
export const sectionSchema = z.enum(["summary", "power", "workloads", "battery"]);
export const sectionLabels = { summary: "Plan summary", power: "Power", workloads: "Workloads", battery: "Battery" };
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
export const briefRequestSchema = z.object({ version: z.literal(BRIEF_VERSION), jobId: z.string().uuid(),
  resultFingerprint: fingerprint }).strict();
const factBase = { id: z.string().min(1).max(120), label: z.string().max(180),
  unit: z.enum(["MW", "MWh AC", "MWh DC", "%", "work h", "count", "min", "status"]),
  scope: z.enum(["full_horizon", "workload_horizon", "submitted_model"]),
  source: z.object({ selector: z.string(), field: z.string(), view: z.enum(["overview", "compute", "power"]) }).strict() };
export const factSchema = z.discriminatedUnion("availability", [
  z.object({ ...factBase, availability: z.literal("available"), value: z.union([z.number().finite(), z.boolean(), z.string().max(200)]) }).strict(),
  z.object({ ...factBase, availability: z.enum(["unavailable", "not_applicable"]), value: z.null() }).strict(),
]);
export type BriefFact = z.infer<typeof factSchema>;
export const selectionSchema = z.object({ findings: z.array(z.string().min(1).max(120)).min(1).max(8),
  actions: z.array(z.enum(["review_workloads", "review_battery", "review_inputs"])).min(1).max(3) }).strict();
const findingSchema = z.object({ id: z.string(), claimType: z.string(), section: sectionSchema,
  text: z.string().max(1200), factIds: z.array(z.string()).max(256) }).strict();
export const receiptSchema = z.object({ jobId: z.string().uuid().nullable(), inputFingerprint: fingerprint,
  resultFingerprint: fingerprint, modelFingerprint: fingerprint, engineVersion: z.string(),
  solverStatus: z.enum(["optimal", "feasible_not_proven_optimal"]), solverTermination: z.string(),
  optimalityGap: z.number().nonnegative().nullable(), truthClass: z.string(),
  horizonStart: z.string().datetime({ offset: true }), horizonEnd: z.string().datetime({ offset: true }),
  intervalCount: z.number().int().positive(), intervalMinutes: z.array(z.number().positive()).min(1),
  evidenceVersion: z.literal(EVIDENCE_VERSION), promptVersion: z.literal(PROMPT_VERSION),
  providerResponseId: z.string().max(200).nullable(),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }).nullable(),
}).strict();
export const briefSchema = z.object({ version: z.literal(BRIEF_VERSION), resultFingerprint: fingerprint,
  generatedAt: z.string().datetime({ offset: true }), model: z.string().min(1).max(100), receipt: receiptSchema,
  findings: z.array(findingSchema).min(1).max(12), evidence: z.array(factSchema).max(256),
  actions: z.array(z.string().max(300)).min(1).max(3), limitations: z.array(z.string().max(500)).max(8),
}).strict().refine(value => value.resultFingerprint === value.receipt.resultFingerprint, "Receipt identity mismatch")
  .refine(value => new Set(value.findings.map(finding => finding.id)).size === value.findings.length &&
    new Set(value.evidence.map(fact => fact.id)).size === value.evidence.length &&
    value.findings.every(finding => finding.factIds.every(id => value.evidence.some(fact => fact.id === id))), "Invalid evidence references");
export type PlanBrief = z.infer<typeof briefSchema>;
