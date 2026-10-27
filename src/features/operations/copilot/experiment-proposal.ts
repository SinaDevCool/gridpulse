import { z } from "zod";
import { experimentFields, experimentRequestSchema, type ExperimentField } from "../../analytics/experiment-contracts";
import type { CanonicalPresentation } from "../canonical-presentation";

/** Provider-neutral suggestions. Only the compiler resolves relative quantities. */
export const proposalSelectionSchema = z.object({
  mode: z.enum(["alternative", "frozen_plan"]),
  changes: z.array(z.object({ field: z.enum(Object.keys(experimentFields) as [ExperimentField, ...ExperimentField[]]),
    asset_id: z.string().max(200).nullable(), operation: z.enum(["set", "multiply"]),
    value: z.number().finite().nonnegative(), unit: z.string().max(20) }).strict()).min(1).max(4),
}).strict();
export const reviewedProposalSchema = z.object({
  request: experimentRequestSchema, digest: z.string().regex(/^[a-f0-9]{64}$/),
  changes: z.array(z.object({ label: z.string(), assetId: z.string().nullable(), before: z.number().finite().nullable(),
    after: z.number().finite(), unit: z.string() }).strict()).min(1).max(4),
  preserved: z.array(z.string()).max(8),
}).strict();
export type ReviewedProposal = z.infer<typeof reviewedProposalSchema>;
export const proposalJsonSchema = { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false,
  required: ["mode", "changes"], properties: { mode: { type: "string", enum: ["alternative", "frozen_plan"] },
    changes: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", additionalProperties: false,
      required: ["field", "asset_id", "operation", "value", "unit"], properties: {
        field: { type: "string", enum: Object.keys(experimentFields) }, asset_id: { type: ["string", "null"] },
        operation: { type: "string", enum: ["set", "multiply"] }, value: { type: "number" }, unit: { type: "string" } } } } } }] };

export function experimentOriginal(a: CanonicalPresentation, field: ExperimentField, assetId?: string | null): number | null {
  const b = a.request.batteries?.find(row => row.resource_id === assetId);
  const w = a.request.workloads.find(row => row.workload_id === assetId);
  const value = field === "battery_energy_mwh" ? b?.rated_energy_mwh : field === "battery_power_mw" ? b?.rated_power_mw :
    field === "initial_soc_fraction" ? b && Number(b.initial_soc_mwh) / (Number(b.rated_energy_mwh) * (1 - Number(b.degradation_fraction ?? 0))) :
    field === "import_limit_mw" ? a.request.facility.import_limit_mw :
    field === "workload_duration_multiplier" ? w && 1 : field === "generation_multiplier" || field === "cooling_load_multiplier" ? 1 : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function compileExperimentProposal(a: CanonicalPresentation, jobId: string, raw: unknown): Promise<ReviewedProposal> {
  const selection = proposalSelectionSchema.parse(raw);
  const seen = new Set<string>();
  const review = selection.changes.map(change => {
    const spec = experimentFields[change.field];
    const ids = spec.asset === "battery" ? (a.request.batteries ?? []).map(b => String(b.resource_id)) :
      spec.asset === "workload" ? a.jobs.map(w => w.id) : [];
    const assetId = change.asset_id ?? (ids.length === 1 ? ids[0] : null);
    if (spec.asset !== "none" && (!assetId || !ids.includes(assetId)) || spec.asset === "none" && change.asset_id !== null)
      throw new Error("Select the exact asset before preparing this experiment.");
    const key = `${change.field}:${assetId}`;
    if (seen.has(key)) throw new Error("One reviewed change per field and asset is required.");
    seen.add(key);
    const before = experimentOriginal(a, change.field, assetId);
    if (change.operation === "multiply" && (before === null || change.unit !== "x")) throw new Error("A relative change requires a known baseline and a dimensionless multiplier.");
    if (change.operation === "set" && change.unit !== spec.unit) throw new Error(`Use ${spec.unit} for this change.`);
    const after = change.operation === "multiply" ? before! * change.value : change.value;
    if (!Number.isFinite(after) || after < spec.min || after > spec.max ||
      (["battery_unavailable_interval", "workload_availability_delay_minutes"].includes(change.field) && !Number.isInteger(after)) ||
      change.field === "battery_unavailable_interval" && after >= a.points.length) throw new Error("The proposed value is outside the qualified experiment bounds.");
    return { field: change.field, label: spec.label, assetId: spec.asset === "none" ? null : assetId, before, after, unit: spec.unit };
  });
  const request = experimentRequestSchema.parse({ schema_version: "gridpulse-facility-experiment-request-v1", baseline_job_id: jobId,
    baseline_result_fingerprint: a.projected.identity.resultFingerprint,
    cases: [{ case_id: "copilot-reviewed-change", mode: selection.mode,
      changes: review.map(r => ({ field: r.field, value: r.after, ...(r.assetId ? { asset_id: r.assetId } : {}) })) }] });
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(request)));
  return reviewedProposalSchema.parse({ request, digest: Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join(""),
    changes: review.map(({ field: _field, ...r }) => r), preserved: ["Unchanged submitted inputs", "Protected reserve and SOC fractions for energy resizing", "Workload permissions and deadlines", "Read-only assessment; no dispatch"] });
}

/** Conservative fast path; ambiguous wording deliberately stays a clarification. */
export function explicitExperimentSelection(question: string) {
  const text = question.toLowerCase();
  if (/\band\b|\balso\b|;/.test(text)) return null;
  const field = /battery/.test(text) && /energy|mwh/.test(text) ? "battery_energy_mwh" :
    /battery/.test(text) && /power|discharge limit/.test(text) ? "battery_power_mw" : /import limit/.test(text) ? "import_limit_mw" : null;
  if (!field) return null;
  const half = /\bhalf\b|\bhalve[ds]?\b/.test(text);
  const match = text.match(/\b(?:to|at|=)\s*(\d+(?:\.\d+)?)\s*(mwh|mw)\b/);
  if ((!half && !match) || (half && match)) return null;
  const unit = match?.[2] === "mwh" ? "MWh" : "MW";
  return proposalSelectionSchema.parse({ mode: /stress|fixed plan/.test(text) ? "frozen_plan" : "alternative",
    changes: [{ field, asset_id: null, operation: half ? "multiply" : "set", value: half ? .5 : Number(match![1]), unit: half ? "x" : unit }] });
}
