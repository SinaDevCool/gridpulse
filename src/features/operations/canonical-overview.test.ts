import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { canonicalAssessmentFacts, canonicalBreachMinutes, canonicalPowerBalance } from "./canonical-overview";

function fixture() {
  const request = buildSyntheticMilpRequest(defaultOperationsScenario);
  const job = canonicalMilpJob(request);
  // Keep the reference components physically consistent with its reported import.
  job.result_payload.result.baseline_facility.points = job.result_payload.result.baseline_facility.points.map(point =>
    ({ ...point, it_power_mw: 59 }));
  return { request, job };
}
describe("canonical overview presentation arithmetic", () => {
  it("reconciles same-interval component changes without a PUE multiplier", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    const balance = canonicalPowerBalance(a, 0)!;
    expect(balance.reconstructed).toBeCloseTo(balance.actual);
    expect(balance.actual).toBe(51);
    expect(balance.steps.find(step => step.label === "IT change")?.value).toBe(-29);
  });
  it("does not replace missing diagnostics with a pass", () => {
    const { request, job } = fixture();
    expect(canonicalAssessmentFacts(selectCanonicalPresentation(job, request))).toEqual({
      recoveryComplete: null, terminalTargetsMet: null, slaViolations: null, importViolations: null,
    });
  });
  it("weights breaches by elapsed interval duration, not sample counts", () => {
    const { request, job } = fixture();
    job.result_payload.result.baseline_facility.points[0].grid_import_mw = 110;
    expect(canonicalBreachMinutes(selectCanonicalPresentation(job, request), true)).toBe(60);
    expect(canonicalBreachMinutes(selectCanonicalPresentation(job, request), false)).toBe(0);
  });
  it("does not invent missing component contributions", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    delete (a.projected.overview.baseline[0] as Record<string, unknown>).losses_mw;
    expect(canonicalPowerBalance(a, 0)).toBeNull();
  });
});
