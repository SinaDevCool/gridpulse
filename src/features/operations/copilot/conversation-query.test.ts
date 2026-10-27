import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../synthetic-milp-request";
import { defaultOperationsScenario } from "../scenario-engine";
import { selectCanonicalPresentation } from "../canonical-presentation";
import { answerConversation } from "./conversation-query";
import { answerAnalysisPlan } from "./analysis-plan";
import { CHAT_VERSION, conversationRequestSchema, querySchema, type ConversationQuery } from "./conversation-contracts";

const input = buildSyntheticMilpRequest(defaultOperationsScenario);
const job = canonicalMilpJob(input);
const a = selectCanonicalPresentation(job, input);
const request = { version: CHAT_VERSION, jobId: job.id, resultFingerprint: job.result_payload.result_fingerprint,
  question: "What happens here?", history: [], context: { view: "compute" as const, timestamp: a.points[0].timestamp, workloadId: null } };
const query: ConversationQuery = { intent: "interval", start: null, end: null, workloadId: null, focus: "selected", definition: "none" };
const provider = { model: "test", responseId: "test", usage: null };
const answer = (change: Partial<ConversationQuery> = {}) => answerConversation(a, request, { ...query, ...change }, provider);

describe("conversation evidence queries", () => {
  it("separates untested investigation hypotheses from checked numerical evidence", () => {
    const result = answerAnalysisPlan(a, request, [{ ...query, intent: "diagnosis" }], provider);
    expect(result.investigation?.status).toBe("requires_independent_validation");
    expect(result.investigation?.hypotheses.every(item => item.status === "untested")).toBe(true);
    expect(result.investigation?.requiredEvidence).toHaveLength(4);
    expect(result.evidence.every(item => item.source.field && item.source.selector)).toBe(true);
    expect(result.blocks.join(" ")).not.toContain("Possible drivers to check");
  });
  it("uses exact selected interval and accepted workload/power values with navigation", () => {
    const result = answer();
    expect(result.kind).toBe("answer");
    expect(result.evidence.find(f => f.id === "interval.0.import")?.value).toBe(a.points[0].gridImportMw);
    expect(result.evidence.filter(f => f.source.selector === "selectCanonicalComputeView")).toHaveLength(a.jobs.length);
    expect(result.navigation[0]).toMatchObject({ view: "compute", timestamp: a.points[0].timestamp });
    expect(result.receipt.resultFingerprint).toBe(request.resultFingerprint);
  });
  it("never invents causal explanations, alternative solves or savings", () => {
    expect(answer({ intent: "why" }).kind).toBe("unsupported");
    expect(answer({ intent: "what_if" }).kind).toBe("requires_calculation");
    expect(answer({ intent: "unsupported" }).evidence).toEqual([]);
  });
  it("clarifies unknown workloads, off-grid times and reversed ranges", () => {
    expect(answer({ intent: "workload", workloadId: "foreign" }).kind).toBe("clarification");
    expect(answer({ start: "2026-09-26T00:01:00.000Z" }).kind).toBe("clarification");
    expect(answer({ start: a.points[2].timestamp, end: a.points[1].timestamp }).kind).toBe("clarification");
  });
  it("summarises longer ranges with labelled representative events instead of truncating silently", () => {
    const result = answer({ end: a.points[8].timestamp });
    expect(result.kind).toBe("answer");
    expect(result.blocks.join(" ")).toContain("Range summary");
    expect(result.evidence.filter(f => f.id.endsWith(".time")).length).toBeLessThanOrEqual(4);
  });
  it("integrates every interval in a range even when only representative samples are shown", () => {
    const result = answer({ end: a.points[8].timestamp });
    const expected = a.points.slice(0, 8).reduce((total, point) => total + point.gridImportMw * (point.durationMinutes ?? 0) / 60, 0);
    expect(result.evidence.find(fact => fact.id === "range.import")?.value).toBeCloseTo(expected);
  });
  it("preserves exclusive ends and includes all four detailed intervals", () => {
    const result = answer({ end: a.points[4].timestamp });
    expect(result.kind).toBe("answer");
    expect(result.evidence.filter(f => f.id.endsWith(".time"))).toHaveLength(4);
    expect(result.evidence.some(f => f.id.startsWith("interval.4."))).toBe(false);
  });
  it("selects workloads by canonical ID and exposes declared constraints without guessing", () => {
    const result = answer({ intent: "constraints", workloadId: a.jobs[0].id });
    expect(result.navigation[0].workloadId).toBe(a.jobs[0].id);
    expect(result.evidence.find(f => f.id === "job.nominal")?.value).toBe(input.workloads[0].nominal_power_mw);
    expect(answer({ intent: "workload", workloadId: a.jobs[0].id }).blocks.join(" ")).toContain("do not imply continuous execution");
  });
  it("shows explicitly limited global constraints and separates curated definitions from model evidence", () => {
    const global = answer({ intent: "constraints" });
    expect(global.kind).toBe("answer");
    expect(global.evidence.find(f => f.id === "power.limit")?.value).toBe(a.limitMw);
    const definition = answer({ intent: "definition", definition: "terminal" });
    expect(definition.basis).toBe("general_explanation"); expect(definition.evidence).toEqual([]);
    expect(definition.receipt.promptVersion).toBe("conversation-analysis-v2");
  });
  it("rejects foreign selected context and accepts equivalent UTC offsets", () => {
    expect(answerConversation(a, { ...request, context: { ...request.context, workloadId: "other-job" } }, query, provider).kind).toBe("clarification");
    expect(answer({ start: a.points[0].timestamp.replace(".000Z", "+00:00") }).kind).toBe("answer");
  });
  it("includes initial SOC when inspecting the lowest reserve and distinguishes AC/DC", () => {
    const result = answer({ intent: "battery", focus: "minimum_soc" });
    expect(result.blocks.join(" ")).toContain("initial boundary");
    expect(result.evidence.some(f => f.unit === "MWh DC")).toBe(true);
    expect(result.evidence.some(f => f.unit === "MWh AC")).toBe(true);
    expect(result.navigation[0].view).toBe("power");
  });
  it("does not claim absent battery values are zero", () => {
    const noBattery = { ...input, batteries: [] };
    const model = selectCanonicalPresentation(canonicalMilpJob(noBattery), noBattery);
    const result = answerConversation(model, request, { ...query, intent: "battery" }, provider);
    expect(result.blocks.join(" ")).toContain("No battery");
    expect(result.evidence.some(f => f.unit === "%")).toBe(false);
  });
  it("retains feasible/unproven and unavailable checks", () => {
    const modified = structuredClone(job);
    modified.result_payload.result.status = "feasible_not_proven_optimal";
    modified.result_payload.result.solver_termination = "limit_reached";
    modified.result_payload.result.optimality_gap = .02;
    (modified.result_payload.result as { assessment: object }).assessment = { feasible: true };
    const result = answerConversation(selectCanonicalPresentation(modified, input), request, { ...query, intent: "checks" }, provider);
    expect(result.blocks.join(" ")).toContain("not proven optimal");
    expect(result.evidence.some(f => f.availability === "unavailable")).toBe(true);
  });
  it("bounds context and rejects assistant supplied facts or extra interpreter fields", () => {
    expect(conversationRequestSchema.safeParse({ ...request, history: Array(7).fill("question") }).success).toBe(false);
    expect(conversationRequestSchema.safeParse({ ...request, facts: [] }).success).toBe(false);
    expect(querySchema.safeParse({ ...query, answer: "invented" }).success).toBe(false);
  });
});
