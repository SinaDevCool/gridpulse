import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { computePowerAxis, matchesCanonicalCompute, selectCanonicalComputeView } from "./canonical-compute";

function fixture(minutes: 15 | 60 = 15) {
  const request = buildSyntheticMilpRequest(defaultOperationsScenario);
  if (minutes === 60) request.intervals = request.intervals.filter((_, i) => i % 4 === 0)
    .map((row, index) => ({ ...row, index, duration_minutes: 60 }));
  return selectCanonicalPresentation(canonicalMilpJob(request), request);
}

describe("canonical compute presentation", () => {
  it.each([15, 60] as const)("reconciles protected/flexible totals without changing %i-minute results", minutes => {
    const a = fixture(minutes);
    const before = JSON.stringify(a);
    const m = selectCanonicalComputeView(a, a.points[0].timestamp);
    expect(m.points).toHaveLength(1440 / minutes);
    for (const point of m.points) expect(point.flexibleMw + point.protectedMw + point.unknownMw).toBeCloseTo(point.workloadPowerMw!);
    expect(m.jobs.filter(job => job.protectedWork)).toHaveLength(1);
    expect(JSON.stringify(a)).toBe(before);
    expect(m.end - m.start).toBe(86400000);
  });
  it("does not fabricate deadline passes or protection when evidence is missing", () => {
    const a = fixture();
    delete a.request.workloads[0].workload_kind;
    const m = selectCanonicalComputeView(a, a.points[0].timestamp);
    expect(m.jobs[0].protectedWork).toBeNull();
    expect(m.jobs[0].deadlineMet).toBeUndefined();
    expect(matchesCanonicalCompute(m.jobs[0], "attention")).toBe(true);
    expect(m.deadlinesMet).toBe(0);
    expect(m.deadlineUnavailable).toBe(5);
    expect(m.points[0].unknownMw).toBe(6);
  });
  it("keeps zero-power checkpoint segments and execution gaps distinct", () => {
    const a = fixture();
    a.jobs[0].points.forEach(point => { point.power_mw = 0; });
    a.jobs[0].points[3].checkpoint_or_restart = true;
    a.jobs[0].points[5].power_mw = 7;
    a.jobs[0].points[5].remaining_work_hours = 2;
    a.jobs[0].endingRemainingWorkHours = 0;
    a.jobs[0].deadlineMet = true;
    const m = selectCanonicalComputeView(a, a.points[5].timestamp);
    expect(m.jobs[0].segments.map(segment => segment.interval_index)).toEqual([3, 5]);
    expect(m.jobs[0].current.remaining_work_hours).toBe(2);
    expect(m.jobs[0].remaining).toBe(0);
    expect(m.jobs[0].attention).toBe(false);
    expect(m.jobs[0].completionTime).toBeUndefined();
  });
  it("filters failures, flexible work and protected work from canonical evidence", () => {
    const a = fixture();
    a.jobs.forEach(job => { job.deadlineMet = true; });
    a.jobs[0].endingRemainingWorkHours = 2;
    a.jobs[1].deadlineMet = false;
    const m = selectCanonicalComputeView(a, a.points[0].timestamp);
    expect(m.jobs.filter(job => matchesCanonicalCompute(job, "attention"))).toHaveLength(2);
    expect(m.jobs.filter(job => matchesCanonicalCompute(job, "flexible"))).toHaveLength(4);
    expect(m.jobs.filter(job => matchesCanonicalCompute(job, "protected"))).toHaveLength(1);
    expect(m.remaining).toBe(2);
  });
  it("flags missing submitted timing even when a returned deadline flag is true", () => {
    const a = fixture();
    a.jobs[0].deadlineMet = true;
    delete (a.request.workloads[0].sla as Record<string, unknown>).deadline;
    const job = selectCanonicalComputeView(a, a.points[0].timestamp).jobs[0];
    expect(job.deadline).toBeNull();
    expect(job.attention).toBe(true);
    expect(job.minimumPower).toBe(a.request.workloads[0].minimum_power_cap_mw);
  });
  it("distinguishes compute demand, running jobs and zero-power checkpoints", () => {
    const a = fixture();
    const last = a.points.length - 1;
    a.jobs.forEach(job => { job.points[last].power_mw = 0; });
    a.jobs[0].points[last].checkpoint_or_restart = true;
    const m = selectCanonicalComputeView(a, a.points[last].timestamp);
    expect(m.running).toBe(0);
    expect(m.checkpoints).toBe(1);
    expect(m.current.flexibleMw + m.current.protectedMw + m.current.unknownMw).toBe(0);
    expect(m.current.timestamp).toBe("2026-09-26T23:45:00.000Z");
    expect(m.current.endTimestamp).toBe("2026-09-27T00:00:00.000Z");
    a.jobs[1].points[last].power_mw = 3;
    expect(selectCanonicalComputeView(a, a.points[last].timestamp).running).toBe(1);
  });
  it("supports a workload-free assessment without invented outcomes", () => {
    const a = fixture();
    a.jobs = [];
    const m = selectCanonicalComputeView(a, a.points[0].timestamp);
    expect(m.completed).toBe(0);
    expect(m.jobs).toHaveLength(0);
    expect(m.running).toBe(0);
    expect(m.current.flexibleMw + m.current.protectedMw + m.current.unknownMw).toBe(0);
  });
  it.each([0, .03, 1, 70.4, 77.385, 250, 1500])("uses a bounded zero-based power axis for %s MW", maximum => {
    const axis = computePowerAxis(maximum);
    expect(axis.ticks[0]).toBe(0);
    expect(axis.maximum).toBeGreaterThanOrEqual(maximum);
    expect(axis.maximum).toBeGreaterThan(0);
    expect(axis.ticks.length).toBeLessThanOrEqual(5);
    expect(axis.ticks.at(-1)).toBe(axis.maximum);
    if (maximum === 77.385) expect(axis.ticks).toEqual([0, 20, 40, 60, 80]);
  });
});
