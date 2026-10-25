import { describe, expect, it, vi } from "vitest";
import { handlePlanConversation, type CopilotConfig } from "./copilot-handler";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../../features/operations/synthetic-milp-request";
import { defaultOperationsScenario } from "../../features/operations/scenario-engine";
import { CHAT_VERSION, conversationResponseSchema } from "../../features/operations/copilot/conversation-contracts";

const job = canonicalMilpJob(buildSyntheticMilpRequest(defaultOperationsScenario));
const body = { version: CHAT_VERSION, jobId: job.id, resultFingerprint: job.result_payload.result_fingerprint,
  question: "Which workloads run then?", history: ["What happens at the selected interval?"],
  context: { view: "compute", timestamp: job.input_payload.intervals[0].start, workloadId: null } };
const options = (): CopilotConfig => ({ COPILOT_ENABLED: "true", OPENAI_API_KEY: "test-secret", COPILOT_ANALYTICS_URL: "https://analytics.invalid",
  COPILOT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } });
const query = { intent: "interval", workloadId: null, start: null, end: null, focus: "selected", definition: "none" };
const response = (selection: unknown = query) => Response.json({ id: "provider-response", status: "completed", model: "test-model",
  usage: { input_tokens: 100, output_tokens: 30 }, output: [{ content: [{ type: "output_text", text: JSON.stringify(selection) }] }] });
const request = (input: unknown = body, auth = "Bearer visitor-token") => new Request("https://app.invalid/api/operations/conversation", {
  method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(input) });

describe("conversation boundary", () => {
  it("loads the owned result, interprets follow-ups and renders verified evidence in one bounded provider call", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response());
    const result = await handlePlanConversation(request(), options(), fetcher);
    expect(result.status).toBe(200);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.receipt).toMatchObject({ jobId: job.id, providerResponseId: "provider-response", usage: { inputTokens: 100, outputTokens: 30 } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const sent = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(sent.store).toBe(false); expect(sent.text.format.strict).toBe(true);
    expect(sent.input).toContain("previousUserQuestions"); expect(sent.input).not.toContain("visitor-token");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects access, identity and oversized-history failures before provider access", async () => {
    const noAuth = vi.fn(); expect((await handlePlanConversation(request(body, ""), options(), noAuth)).status).toBe(401);
    expect(noAuth).not.toHaveBeenCalled();
    const foreign = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    expect((await handlePlanConversation(request(), options(), foreign)).status).toBe(404); expect(foreign).toHaveBeenCalledTimes(1);
    const mismatch = vi.fn().mockResolvedValue(Response.json(job));
    expect((await handlePlanConversation(request({ ...body, resultFingerprint: "f".repeat(64) }), options(), mismatch)).status).toBe(409);
    const invalid = vi.fn(); expect((await handlePlanConversation(request({ ...body, history: Array(7).fill("x") }), options(), invalid)).status).toBe(400);
    expect(invalid).not.toHaveBeenCalled();
  });
  it("shares the brief allowance and does not retry unsupported provider output", async () => {
    const config = options(); config.COPILOT_RATE_LIMITER!.limit = vi.fn().mockResolvedValue({ success: false });
    const fetcher = vi.fn(); expect((await handlePlanConversation(request(), config, fetcher)).status).toBe(429);
    expect(config.COPILOT_RATE_LIMITER!.limit).toHaveBeenCalledWith({ key: "brief:local" });
    for (const selection of [{ ...query, intent: "run_code" }, { ...query, prose: "Invented savings" }]) {
      const provider = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(response(selection));
      expect((await handlePlanConversation(request(), options(), provider)).status).toBe(422); expect(provider).toHaveBeenCalledTimes(2);
    }
  });
  it("clarifies a bare hour without spending a provider call or guessing morning/evening", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job));
    const result = await handlePlanConversation(request({ ...body, question: "What happens at eight?" }), options(), fetcher);
    const answer = conversationResponseSchema.parse(await result.json());
    expect(answer.kind).toBe("clarification"); expect(answer.receipt.providerResponseId).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
