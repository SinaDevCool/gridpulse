import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "../scenario-engine";
import { assessWorkloads, buildScenarioWorkloads } from "../workload-intelligence";
import {
  candidateInterval,
  selectComputeTimeline,
  workloadTimeRelationship,
} from "./select-compute-timeline";

const model = buildOperationsScenario();
const job = assessWorkloads(buildScenarioWorkloads(model), [], model).decisions.find(
  (j) => j.recommended,
)!;
describe("coordinated compute projections", () => {
  it("uses the existing battery assessment and never creates negative required reduction", () => {
    const points = selectComputeTimeline(model.intervals, 98);
    expect(Math.max(...points.map((p) => p.requiredWorkloadMw))).toBeCloseTo(
      Math.max(...model.intervals.map((p) => p.batteryDemandMw)) - 98,
    );
    expect(points.every((p) => p.requiredWorkloadMw >= 0)).toBe(true);
    expect(points[0].baselineDemandMw).toBe(model.intervals[0].baselineDemandMw);
  });
  it("uses actual interval durations, including single-interval windows", () => {
    const point = { ...model.intervals[0], durationMinutes: 7 };
    expect(selectComputeTimeline([point], 98)[0].end - Date.parse(point.timestamp)).toBe(
      7 * 60_000,
    );
    expect(selectComputeTimeline([], 98)).toEqual([]);
  });
  it("infers irregular durations only when metadata is unavailable", () => {
    const points = [
      model.intervals[0],
      {
        ...model.intervals[1],
        timestamp: new Date(Date.parse(model.intervals[0].timestamp) + 9 * 60_000).toISOString(),
      },
    ].map((p) => ({ ...p, durationMinutes: undefined }));
    expect(selectComputeTimeline(points, 98)[0].end - Date.parse(points[0].timestamp)).toBe(
      9 * 60_000,
    );
  });
  it("labels reference windows without claiming execution or job completion", () => {
    expect(workloadTimeRelationship(job, job.earliestStart)).toContain("not execution");
    expect(workloadTimeRelationship(job, job.proposedStart)).toContain("not execution");
    expect(workloadTimeRelationship(job, job.deadline)).toContain("Outside");
    expect(workloadTimeRelationship(undefined, job.deadline)).toContain("Select a workload");
    expect(workloadTimeRelationship({ ...job, deadline: "invalid" }, job.earliestStart)).toContain(
      "unavailable",
    );
  });
  it("jumps only to available displayed intervals without changing the assessment", () => {
    expect(candidateInterval(job, [])).toBeUndefined();
    expect(candidateInterval(job, [model.intervals[0]])).toBe(model.intervals[0].timestamp);
    expect(candidateInterval(job, model.intervals)).toBe(job.proposedStart);
  });
});
