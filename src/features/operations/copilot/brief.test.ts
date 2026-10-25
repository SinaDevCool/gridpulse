import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../synthetic-milp-request";
import { defaultOperationsScenario } from "../scenario-engine";
import { selectCanonicalPresentation } from "../canonical-presentation";
import { buildBriefEvidence, renderPlanBrief, briefText } from "./brief";

function fixture() {
  const request = buildSyntheticMilpRequest(defaultOperationsScenario);
  const job = canonicalMilpJob(request);
  return { request, job };
}
describe("grounded plan brief", () => {
  it("keeps omitted checks unavailable and forces warnings into the rendered brief", () => {
    const { job, request } = fixture();
    (job.result_payload.result as { assessment: object }).assessment = { feasible: true };
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    const brief = renderPlanBrief({ findings: ["peak"], actions: ["review_inputs"] }, evidence, "test");
    expect(brief.findings.some(fact => fact.id === "check_completion" && fact.text.includes("Unavailable"))).toBe(true);
    expect(brief.findings.some(fact => fact.id === "solver")).toBe(true);
    expect(briefText(brief)).toContain("not measured delivery");
  });
  it("rejects invented claims, duplicate references and arbitrary prose", () => {
    const { job, request } = fixture();
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    for (const raw of [
      { findings: ["savings"], actions: ["review_inputs"] },
      { findings: ["peak", "peak"], actions: ["review_inputs"] },
      { findings: ["peak"], actions: ["dispatch_battery"] },
      { findings: ["peak"], actions: ["review_inputs"], text: "Guaranteed capacity" },
    ]) expect(() => renderPlanBrief(raw, evidence, "test")).toThrow();
  });
  it("uses the accepted assessment identity and full-horizon breach duration", () => {
    const { job, request } = fixture();
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    const brief = renderPlanBrief({ findings: ["peak", "limit"], actions: ["review_workloads"] }, evidence, "test");
    expect(brief.resultFingerprint).toBe(job.result_payload.result_fingerprint);
    expect(brief.findings.find(fact => fact.id === "limit")?.text).toContain("full horizon");
  });
});
