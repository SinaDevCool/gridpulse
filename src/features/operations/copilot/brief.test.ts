import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../synthetic-milp-request";
import { defaultOperationsScenario } from "../scenario-engine";
import { selectCanonicalPresentation } from "../canonical-presentation";
import { buildBriefEvidence, renderPlanBrief, briefText, eligibleBriefClaims, formatBriefFact, briefReviewIdentity, briefContentDigest } from "./brief";
import { factSchema, briefSchema } from "./contracts";

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
  it("preserves no-battery applicability rather than inventing SOC or zero energy", () => {
    const { request } = fixture(); request.batteries = [];
    const evidence = buildBriefEvidence(selectCanonicalPresentation(canonicalMilpJob(request), request));
    expect(evidence.facts.find(fact => fact.id === "battery.minimum_soc")).toMatchObject({ availability: "not_applicable", value: null });
    const brief = renderPlanBrief({ findings: ["peak"], actions: ["review_inputs"] }, evidence, "test");
    expect(brief.findings.map(finding => finding.id)).toContain("no_battery");
    expect(brief.findings.map(finding => finding.id)).not.toContain("battery_energy");
  });
  it.each([15, 30, 60] as const)("weights the %i-minute horizon and exposes resolution", duration => {
    const { request } = fixture();
    request.intervals = request.intervals.filter((_, index) => index % (duration / 15) === 0)
      .map((interval, index) => ({ ...interval, index, duration_minutes: duration }));
    const job = canonicalMilpJob(request);
    job.result_payload.result.facility.points[0].grid_import_mw = 105;
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    expect(evidence.facts.find(fact => fact.id === "power.breach_minutes")?.value).toBe(duration);
    expect(evidence.receipt.intervalMinutes).toEqual([duration]);
    expect(Date.parse(evidence.receipt.horizonEnd) - Date.parse(evidence.receipt.horizonStart)).toBe(86400000);
  });
  it("does not decide target compliance from rounded values or label an incumbent optimal", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    a.planPeakMw = a.targetMw + .02;
    a.points[0].gridImportMw = a.planPeakMw;
    const evidence = buildBriefEvidence(a);
    const claims = eligibleBriefClaims(evidence).map(claim => claim.id);
    expect(claims).toContain("target_unmet"); expect(claims).not.toContain("target_met");
    expect(() => renderPlanBrief({ findings: ["target_met"], actions: ["review_inputs"] }, evidence, "test")).toThrow();
    const incumbent = { ...evidence, identity: { ...evidence.identity, status: "feasible_not_proven_optimal" as const } };
    expect(eligibleBriefClaims(incumbent).find(claim => claim.id === "solver")?.text).toContain("not proven optimal");
  });
  it("distinguishes missing and false facts and exports receipt plus human acknowledgement", () => {
    const { request, job } = fixture();
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request), job.id);
    const booleanFact = { ...evidence.facts[0], value: false, availability: "available" as const };
    expect(formatBriefFact(booleanFact)).toBe("No");
    expect(() => factSchema.parse({ ...booleanFact, availability: "unavailable" })).toThrow();
    const brief = renderPlanBrief({ findings: ["battery_energy"], actions: ["review_battery"] }, evidence, "test");
    const text = briefText(brief, "2026-10-25T12:00:00.000Z");
    expect(text).toContain("MWh AC"); expect(text).toContain("MWh DC");
    expect(text).toContain('"modelFingerprint"'); expect(text).toContain(job.id);
    expect(text).toContain("Human review: 2026-10-25");
  });
  it("requires resolvable section references and preserves a false completion check", () => {
    const { request, job } = fixture(); job.result_payload.result.assessment.recovery_complete = false;
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    const brief = renderPlanBrief({ findings: ["peak"], actions: ["review_inputs"] }, evidence, "test");
    expect(brief.findings.find(finding => finding.id === "check_completion")?.text).toContain("Unresolved");
    expect(new Set(brief.findings.map(finding => finding.section))).toEqual(new Set(["summary", "power", "workloads", "battery"]));
  });
  it("rejects an oversized final brief and unresolved references", () => {
    const { request, job } = fixture();
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request));
    const brief = renderPlanBrief({ findings: ["peak"], actions: ["review_inputs"] }, evidence, "test");
    expect(() => briefSchema.parse({ ...brief, findings: Array.from({ length: 13 }, (_, i) => ({ ...brief.findings[0], id: `claim${i}` })) })).toThrow();
    expect(() => briefSchema.parse({ ...brief, evidence: [] })).toThrow();
  });
});


it("invalidates review identity and export digest when evidence content changes", async () => {
  const { request, job } = fixture();
  const brief = renderPlanBrief({ findings: ["peak"], actions: ["review_inputs"] }, buildBriefEvidence(selectCanonicalPresentation(job, request)), "test");
  const original = briefReviewIdentity(brief);
  const digest = await briefContentDigest(brief);
  expect(digest).toMatch(/^[a-f0-9]{64}$/);
  const changed = { ...brief, knowledgeVersion: "changed-corpus" };
  expect(briefReviewIdentity(changed)).not.toBe(original);
  expect(await briefContentDigest(changed)).not.toBe(digest);
});
