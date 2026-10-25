import { describe, expect, it, vi } from "vitest";
import { handlePlanBrief, type CopilotConfig } from "./copilot-handler";
import { BRIEF_VERSION, briefSchema } from "../../features/operations/copilot/brief";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../../features/operations/synthetic-milp-request";
import { defaultOperationsScenario } from "../../features/operations/scenario-engine";

const job = canonicalMilpJob(buildSyntheticMilpRequest(defaultOperationsScenario));
const config = (): CopilotConfig => ({ COPILOT_ENABLED: "true", OPENAI_API_KEY: "provider-test-secret",
  COPILOT_ANALYTICS_URL: "https://analytics.invalid", COPILOT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } });
const input = { version: BRIEF_VERSION, jobId: job.id, resultFingerprint: job.result_payload.result_fingerprint };
const request = (value: unknown = input, authorization = "Bearer owner-session") => new Request("https://app.invalid/api/operations/brief", {
  method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(value),
});
const output = { id: "response-test", status: "completed", model: "qualified-test-model", usage: { input_tokens: 100, output_tokens: 20 },
  output: [{ content: [{ type: "output_text", text: JSON.stringify({ findings: ["peak", "battery_energy"], actions: ["review_inputs"] }) }] }] };

describe("complete explanation endpoint", () => {
  it("retrieves owned evidence, validates provider selection and returns a complete receipt", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(Response.json(output));
    const response = await handlePlanBrief(request(), config(), fetcher);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const brief = briefSchema.parse(await response.json());
    expect(brief.receipt).toMatchObject({ jobId: job.id, providerResponseId: "response-test", usage: { inputTokens: 100, outputTokens: 20 }, intervalCount: 96 });
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer owner-session");
    expect(fetcher.mock.calls[1][0]).toBe("https://api.openai.com/v1/responses");
    expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer provider-test-secret");
    expect(fetcher.mock.calls[1][1].body).not.toContain("owner-session");
  });
  it("rejects disabled, missing-secret, missing-session, bad-version and oversized requests before upstream access", async () => {
    const fetcher = vi.fn();
    for (const [req, options, status] of [
      [request(), { ...config(), COPILOT_ENABLED: "false" }, 503],
      [request(), { ...config(), OPENAI_API_KEY: undefined }, 503],
      [request(input, ""), config(), 401],
      [request({ ...input, version: "unknown" }), config(), 400],
      [request({ ...input, jobId: "invalid" }), config(), 400],
      [request({ ...input, facts: "x".repeat(3000) }), config(), 413],
    ] as const) expect((await handlePlanBrief(req, options, fetcher)).status).toBe(status);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not call OpenAI for a foreign job, mismatched result or excessive upstream payload", async () => {
    const cases = [
      { req: request(), upstream: new Response(null, { status: 404 }), status: 404 },
      { req: request({ ...input, resultFingerprint: "f".repeat(64) }), upstream: Response.json(job), status: 409 },
      { req: request(), upstream: new Response("{}", { headers: { "content-length": "4000001" } }), status: 502 },
    ];
    for (const item of cases) {
      const fetcher = vi.fn().mockResolvedValueOnce(item.upstream);
      expect((await handlePlanBrief(item.req, config(), fetcher)).status).toBe(item.status);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("enforces the copilot limiter independently of calculation limits", async () => {
    const options = config(); options.COPILOT_RATE_LIMITER!.limit = vi.fn().mockResolvedValue({ success: false });
    const fetcher = vi.fn(); const response = await handlePlanBrief(request(), options, fetcher);
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("handles timeouts, malformed output and unsupported selections without a checked draft or retry", async () => {
    const timeout = vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect((await handlePlanBrief(request(), config(), timeout)).status).toBe(504);
    for (const upstream of [new Response("not JSON"), Response.json({ ...output,
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ findings: ["guaranteed_savings"], actions: ["review_inputs"] }) }] }] })]) {
      const fetcher = vi.fn().mockResolvedValueOnce(Response.json(job)).mockResolvedValueOnce(upstream);
      const response = await handlePlanBrief(request(), config(), fetcher);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.json()).not.toHaveProperty("findings");
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });
});
