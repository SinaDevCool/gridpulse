import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { canonicalAssessmentFacts, canonicalBreachMinutes, canonicalPowerBalance, canonicalChecks, canonicalImpact } from "./canonical-overview";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanonicalModelChecks } from "./CanonicalModelChecks";

function fixture(duration: 15 | 60 = 15) {
  const request = buildSyntheticMilpRequest(defaultOperationsScenario);
  if (duration === 60) request.intervals = request.intervals.filter((_, i) => i % 4 === 0)
    .map((interval, index) => ({ ...interval, index, duration_minutes: 60 }));
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
    (job.result_payload.result as { assessment: object }).assessment = { feasible: true };
    const a = selectCanonicalPresentation(job, request);
    expect(canonicalAssessmentFacts(a)).toEqual({
      recoveryComplete: null, terminalTargetsMet: null, slaViolations: null, importViolations: null,
    });
    expect(canonicalChecks(a).find(check => check.id === "completion")?.state).toBe("unavailable");
    const html = renderToStaticMarkup(createElement(CanonicalModelChecks, { assessment: a }));
    expect(html).toContain("Review required");
    expect(html).toContain('data-state="unavailable"');
  });
  it("keeps full-horizon impact and warnings separate from interval inspection", () => {
    const { request, job } = fixture();
    job.result_payload.result.assessment.recovery_complete = false;
    const a = selectCanonicalPresentation(job, request);
    expect(canonicalChecks(a).find(check => check.id === "completion")?.state).toBe("failed");
    const impact = canonicalImpact(a);
    expect(impact.scope).toBe("full_horizon");
    expect(impact.durationMs).toBe(24 * 60 * 60_000);
    expect(impact.planPeakMw).toBe(51);
  });
  it("reads the engine SLA collection without confusing it with a numeric field", () => {
    const { request, job } = fixture();
    expect(canonicalAssessmentFacts(selectCanonicalPresentation(job, request)).slaViolations).toBe(0);
  });
  it.each([15, 60] as const)("weights breaches by elapsed %i-minute duration, preserving older results", duration => {
    const { request, job } = fixture(duration);
    job.result_payload.result.baseline_facility.points[0].grid_import_mw = 110;
    expect(canonicalBreachMinutes(selectCanonicalPresentation(job, request), true)).toBe(duration);
    expect(canonicalBreachMinutes(selectCanonicalPresentation(job, request), false)).toBe(0);
  });
  it("does not invent missing component contributions", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    delete (a.projected.overview.baseline[0] as Record<string, unknown>).losses_mw;
    expect(canonicalPowerBalance(a, 0)).toBeNull();
  });
  it("shows discrepancies rather than silently attributing them to workload savings", () => {
    const { request, job } = fixture();
    job.result_payload.result.baseline_facility.points[0].grid_import_mw = 90;
    const balance = canonicalPowerBalance(selectCanonicalPresentation(job, request), 0)!;
    expect(balance.reconstructed - balance.actual).toBeCloseTo(10);
  });
  it("accounts explicitly for non-export import clipping", () => {
    const { request, job } = fixture();
    job.result_payload.result.facility.points[0].onsite_generation_mw = 60;
    job.result_payload.result.facility.points[0].grid_import_mw = 0;
    const balance = canonicalPowerBalance(selectCanonicalPresentation(job, request), 0)!;
    expect(balance.reconstructed).toBeCloseTo(0);
    expect(balance.steps.find(step => step.label === "Export clipping")?.value).toBe(9);
  });
});
