import { describe, expect, it, vi } from "vitest";
import { handlePlanConversation, type CopilotConfig } from "./copilot-handler";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../../features/operations/synthetic-milp-request";
import { defaultOperationsScenario } from "../../features/operations/scenario-engine";
import { CHAT_VERSION, conversationResponseSchema } from "../../features/operations/copilot/conversation-contracts";
import { renderGroundedDraft } from "./copilot-composition";

const job = canonicalMilpJob(buildSyntheticMilpRequest(defaultOperationsScenario));
const body = { version: CHAT_VERSION, jobId: job.id, resultFingerprint: job.result_payload.result_fingerprint,
  question: "Are all workloads complete?", history: [], transcript: [],
  context: { view: "compute", timestamp: job.input_payload.intervals[0].start, workloadId: null } };
const config: CopilotConfig = { COPILOT_ENABLED: "true", META_API_KEY: "meta-test", COPILOT_PROVIDER: "meta",
  COPILOT_MODEL: "muse-spark-1.3", COPILOT_ANALYTICS_URL: "https://analytics.invalid",
  COPILOT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const query = { intent: "checks", workloadId: null, start: null, end: null, focus: "selected", definition: "none" };
const response = (selection: unknown) => Response.json({ id: "writer-response", status: "completed", model: "muse-spark-1.3",
  usage: { input_tokens: 100, output_tokens: 30 }, output: [{ content: [{ type: "output_text", text: JSON.stringify(selection) }] }] });
const draft = { paragraphs: [{ text: "The plan completes {{fact:workloads.completed}} workloads. This is modelled completion, so verify execution with the scheduler before relying on delivery.",
  factIds: ["workloads.completed"], guidanceIds: [] }] };
const request = (input: unknown = body) => new Request("https://app.invalid/api/operations/conversation", {
  method: "POST", headers: { authorization: "Bearer visitor", "content-type": "application/json" }, body: JSON.stringify(input) });

describe("grounded conversational writing", () => {
  it("uses Meta for interpretation and natural writing, retaining checked receipt and sources", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job))
      .mockResolvedValueOnce(response({ queries: [query], proposal: null })).mockResolvedValueOnce(response(draft));
    const result = await handlePlanConversation(request(), config, fetcher);
    expect(result.status).toBe(200);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.presentation).toBe("grounded_conversation");
    expect(answer.blocks[0]).toContain("modelled completion");
    expect(answer.blocks[0]).not.toContain("{{fact:");
    expect(answer.receipt.resultFingerprint).toBe(body.resultFingerprint);
    expect(answer.receipt.generation?.attempts).toEqual(["meta"]);
    expect(answer.receipt.usage).toEqual({ inputTokens: 200, outputTokens: 60 });
    expect(() => renderGroundedDraft({ paragraphs: [{ text: "This result should not be read as proven optimal. Review {{fact:workloads.completed}} completed workloads as model evidence, not guaranteed delivery.",
      factIds: ["workloads.completed"], guidanceIds: [] }] }, { ...answer, receipt: { ...answer.receipt, solverStatus: "feasible_not_proven_optimal" } })).not.toThrow();
    expect(fetcher.mock.calls.slice(1).every(call => call[0] === "https://api.meta.ai/v1/responses")).toBe(true);
    const writer = JSON.parse(String(fetcher.mock.calls[2][1]?.body));
    expect(writer.store).toBe(false);
    expect(JSON.parse(writer.input).facts.some((fact: { id: string }) => fact.id === "workloads.completed")).toBe(true);
  });
  it("passes bounded assistant replies to both stages as untrusted follow-up context", async () => {
    const transcript = [{ question: "How did it perform?", answer: "The plan completed the submitted work." }];
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job))
      .mockResolvedValueOnce(response({ queries: [query], proposal: null })).mockResolvedValueOnce(response(draft));
    await handlePlanConversation(request({ ...body, question: "What should I check next?", transcript }), config, fetcher);
    expect(JSON.parse(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).input).previousConversation).toEqual(transcript);
    expect(JSON.parse(JSON.parse(String(fetcher.mock.calls[2][1]?.body)).input).conversation).toEqual(transcript);
  });
  it("keeps a named deadline question scoped to that workload", async () => {
    const id = job.input_payload.workloads[0].workload_id;
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job))
      .mockResolvedValueOnce(response({ queries: [{ ...query, workloadId: id }], proposal: null })).mockResolvedValueOnce(response(draft));
    const answer = conversationResponseSchema.parse(await (await handlePlanConversation(request({ ...body, question: "Will this workload meet its deadline?" }), config, fetcher)).json());
    expect(answer.resolvedQuery?.intent).toBe("workload");
    expect(answer.evidence.some(fact => fact.id === "job.name")).toBe(true);
  });
  it.each([
    { paragraphs: [{ text: "The peak is 999 MW.", factIds: ["power.plan_peak"], guidanceIds: [] }] },
    { paragraphs: [{ text: "Peak {{fact:invented}}", factIds: ["invented"], guidanceIds: [] }] },
    { paragraphs: [{ text: "Dispatch is guaranteed.", factIds: ["power.plan_peak"], guidanceIds: [] }] },
    { paragraphs: [{ text: "This ensures compliance with operational safety standards.", factIds: ["workloads.completed"], guidanceIds: [] }] },
    { paragraphs: [{ text: "Everything is fine.", factIds: [], guidanceIds: [] }] },
    { paragraphs: [{ text: "Peak {{fact:power.plan_peak}} MW.", factIds: ["power.plan_peak"], guidanceIds: [] }] },
    { paragraphs: [{ text: "Minimum SOC {{fact:battery.minimum_soc}}%.", factIds: ["battery.minimum_soc"], guidanceIds: [] }] },
  ])("rejects unverified prose and returns the existing checked answer", async invalid => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job))
      .mockResolvedValueOnce(response({ queries: [query], proposal: null })).mockResolvedValueOnce(response(invalid));
    const answer = conversationResponseSchema.parse(await (await handlePlanConversation(request(), config, fetcher)).json());
    expect(answer.presentation).toBe("checked_fallback");
    expect(answer.blocks.join(" ")).not.toContain("999");
    expect(() => renderGroundedDraft(invalid, answer)).toThrow();
  });
  it("keeps reviewed definitions without an unsupported writing call", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job))
      .mockResolvedValueOnce(response({ queries: [{ ...query, intent: "definition", definition: "power_energy" }], proposal: null }));
    const answer = conversationResponseSchema.parse(await (await handlePlanConversation(request({ ...body,
      question: "What is the difference between MW and MWh?" }), config, fetcher)).json());
    expect(answer.kind).toBe("answer");
    expect(answer.resolvedQuery?.intent).toBe("definition");
    expect(answer.presentation).not.toBe("checked_fallback");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not write a hypothetical numerical answer or submit an experiment", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const answer = conversationResponseSchema.parse(await (await handlePlanConversation(request({ ...body,
      question: "What if battery energy is halved?" }), config, fetcher)).json());
    expect(answer.kind).toBe("requires_calculation");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
