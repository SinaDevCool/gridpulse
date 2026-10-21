import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "../scenario-engine";
import { assessWorkloads, buildScenarioWorkloads } from "../workload-intelligence";
import { matchesReviewGroup, selectReviewGroups } from "./select-review-groups";
import { paginateWorkloadDecisions } from "./select-workload-queue";

const model = buildOperationsScenario();
const jobs = assessWorkloads(buildScenarioWorkloads(model), [], model).decisions;
describe("workload review projections", () => {
  it("partitions all records into mutually exclusive decision groups", () => {
    expect(selectReviewGroups(jobs).map((item) => item.count)).toEqual([1, 3, 1]);
    for (const job of jobs)
      expect(
        ["candidate", "eligible", "protected"].filter((group) =>
          matchesReviewGroup(job, group as "candidate" | "eligible" | "protected"),
        ),
      ).toHaveLength(1);
  });
  it("handles an empty queue without inventing available flexibility", () => {
    expect(selectReviewGroups([]).every((item) => item.count === 0)).toBe(true);
    expect(paginateWorkloadDecisions([], 10)).toMatchObject({
      pageCount: 1,
      visiblePage: 0,
      visibleDecisions: [],
    });
  });
  it("keeps protected jobs out of candidate and other-eligible groups", () => {
    const protectedJob = jobs.find((job) => job.workloadClass === "critical")!;
    expect(matchesReviewGroup(protectedJob, "protected")).toBe(true);
    expect(matchesReviewGroup(protectedJob, "candidate")).toBe(false);
    expect(matchesReviewGroup(protectedJob, "eligible")).toBe(false);
  });
  it("bounds filtered pages and retains all records without mutating input", () => {
    const many = Array.from({ length: 126 }, (_, index) => ({
      ...jobs[0],
      workloadId: String(index),
    }));
    const ids = many.map((job) => job.workloadId);
    expect(paginateWorkloadDecisions(many, 10)).toMatchObject({ pageCount: 3, visiblePage: 2 });
    expect(paginateWorkloadDecisions(many, 10).visibleDecisions).toHaveLength(26);
    expect(many.map((job) => job.workloadId)).toEqual(ids);
  });
});
