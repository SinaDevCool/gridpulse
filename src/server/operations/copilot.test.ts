import { describe, expect, it, vi } from "vitest";
import { ownedBriefEvidence, generatePlanBrief, requestCopilotSelection } from "./copilot";
import { buildBriefEvidence } from "../../features/operations/copilot/brief";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../../features/operations/synthetic-milp-request";
import { defaultOperationsScenario } from "../../features/operations/scenario-engine";
import { selectCanonicalPresentation } from "../../features/operations/canonical-presentation";

const request = buildSyntheticMilpRequest(defaultOperationsScenario);
const job = canonicalMilpJob(request);
describe("plan copilot server boundary", () => {
  it("does not call the upstream service without a bearer session", async () => {
    const fetcher = vi.fn();
    await expect(ownedBriefEvidence("https://analytics.invalid", "", job.id, "a".repeat(64), fetcher)).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fails closed for foreign jobs and mismatched assessment identities", async () => {
    await expect(ownedBriefEvidence("https://analytics.invalid", "Bearer visitor", job.id, "a".repeat(64),
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })))).rejects.toMatchObject({ status: 404 });
    await expect(ownedBriefEvidence("https://analytics.invalid", "Bearer visitor", job.id, "f".repeat(64),
      vi.fn().mockResolvedValue(Response.json(job)))).rejects.toMatchObject({ status: 409 });
  });
  it("forwards ownership authorization only to analytics, not the model", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(job));
    const evidence = await ownedBriefEvidence("https://analytics.invalid", "Bearer visitor", job.id, job.result_payload.result_fingerprint, fetcher);
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer visitor");
    expect(JSON.stringify(evidence)).not.toContain("visitor");
    expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
  });
  it("rejects upstream redirects without forwarding calculation or provider credentials", async () => {
    const redirect = () => new Response(null, { status: 302, headers: { location: "https://untrusted.invalid" } });
    const analytics = vi.fn().mockResolvedValue(redirect());
    await expect(ownedBriefEvidence("https://analytics.invalid", "Bearer visitor", job.id, "a".repeat(64), analytics))
      .rejects.toMatchObject({ status: 502 });
    expect(analytics).toHaveBeenCalledTimes(1);
    expect(analytics.mock.calls[0][1].redirect).toBe("manual");
    const provider = vi.fn().mockResolvedValue(redirect());
    await expect(requestCopilotSelection({}, "Select", {}, "test-key", "test", provider)).rejects.toThrow();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][1].redirect).toBe("manual");
  });
  it("rejects incomplete/refused responses and accepts only allowed fact IDs", async () => {
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    for (const payload of [{ status: "incomplete" }, { status: "completed", output: [{ content: [{ type: "refusal" }] }] }]) {
      await expect(generatePlanBrief(evidence, "test-key", "test", vi.fn().mockResolvedValue(Response.json(payload)))).rejects.toThrow();
    }
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [{ content: [{ type: "output_text",
      text: JSON.stringify({ findings: ["peak"], actions: ["review_inputs"] }) }] }] }));
    const brief = await generatePlanBrief(evidence, "test-key", "test", fetcher);
    expect(brief.findings.map(fact => fact.id)).toContain("solver");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).store).toBe(false);
  });
  it("distinguishes exhausted credits from transient rate limiting", async () => {
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    await expect(generatePlanBrief(evidence, "test-key", "test", vi.fn().mockResolvedValue(Response.json({
      error: { code: "credit_balance_exhausted", type: "insufficient_quota" },
    }, { status: 429 })))).rejects.toThrow("credits or spending quota");
  });
});
