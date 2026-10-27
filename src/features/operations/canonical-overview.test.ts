import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { canonicalAssessmentFacts, canonicalBreachMinutes, canonicalPowerBalance, canonicalChecks, canonicalImpact, canonicalCheckSummary, canonicalMargins } from "./canonical-overview";
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
    expect(html).toContain("Some checks unavailable");
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
  it("keeps SOC out of the check count and prioritises unresolved evidence", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    a.jobs.forEach(workload => { workload.deadlineMet = true; });
    expect(canonicalCheckSummary(a).checks).toHaveLength(4);
    expect(canonicalCheckSummary(a).checks.some(check => check.id === "soc")).toBe(false);
    expect(canonicalCheckSummary(a).label).toBe("No unresolved checks");
    (a.projected.assessment as Record<string, unknown>).recovery_complete = false;
    delete (a.projected.assessment as Record<string, unknown>).import_limit_violations;
    expect(canonicalCheckSummary(a).label).toBe("Review required");
    expect(canonicalCheckSummary(a).unavailable).toHaveLength(1);
    const html = renderToStaticMarkup(createElement(CanonicalModelChecks, { assessment: a }));
    expect(html).toContain('data-state="failed"');
    expect(html).toContain("Minimum modelled SOC");
    expect(html).toContain("protected reserve");
    expect(html).toContain("Foundation model training");
  });
  it("keeps no-battery checks not applicable rather than passed", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    a.batteryAudit = null;
    const summary = canonicalCheckSummary(a);
    expect(summary.checks.find(check => check.id === "terminal")?.state).toBe("not_applicable");
    expect(summary.measurement.value).toBe("No battery");
  });
  it("keeps missing workload details unavailable and resolves names with an ID fallback", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    a.jobs[0].points = [];
    a.jobs[0].endingRemainingWorkHours = undefined;
    a.jobs[0].deadlineMet = undefined;
    delete a.request.workloads[0].name;
    const html = renderToStaticMarkup(createElement(CanonicalModelChecks, { assessment: a }));
    expect(html).toContain(a.jobs[0].id);
    expect(html).toContain("<td>Unavailable</td><td>Unavailable</td>");
    expect(canonicalCheckSummary(a).state).toBe("unavailable");
  });
  it("does not turn zero declared SLA violations into missing deadline passes", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    expect(canonicalCheckSummary(a).label).toBe("Some checks unavailable");
    expect(canonicalCheckSummary(a).checks.find(check => check.id === "sla")?.value).toContain("5 deadline checks unavailable");
    a.jobs[0].deadlineMet = false;
    expect(canonicalCheckSummary(a).state).toBe("failed");
    a.jobs.forEach(workload => { workload.deadlineMet = true; });
    a.jobs[0].endingRemainingWorkHours = 2;
    expect(canonicalCheckSummary(a).checks.find(check => check.id === "completion")?.state).toBe("failed");
  });
  it("preserves whole-plan margins while interval margins move through positive, zero and negative", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    a.points[0].gridImportMw = a.targetMw;
    a.points[1].gridImportMw = a.limitMw + 2;
    const first = canonicalMargins(a, 0);
    const next = canonicalMargins(a, 1);
    expect(first[0]).toEqual(next[0]);
    expect(first[0].safety).toBeGreaterThan(0);
    expect(first[1].safety).toBe(0);
    expect(next[1].facility).toBe(-2);
  });
});


it("uses interval envelopes rather than the reference ceiling for breaches and margins", () => {
  const { request, job } = fixture();
  request.facility.import_limit_profile_mw = request.intervals.map((_, i) => i === 0 ? 50 : 100);
  request.policy.operating_target_profile_mw = request.intervals.map((_, i) => i === 0 ? 48 : 98);
  const a = selectCanonicalPresentation(job, request);
  expect(canonicalBreachMinutes(a, false)).toBe(15);
  expect(canonicalMargins(a, 0)[0].facility).toBe(-1);
  expect(canonicalMargins(a, 0)[0].safety).toBe(-3);
});
