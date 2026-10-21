import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "../scenario-engine";
import { assessWorkloads, buildScenarioWorkloads } from "../workload-intelligence";
import { scopeOperationsModel } from "../operating-context";
import { selectComputeSummary, workloadWindow } from "./select-compute-summary";

const model = buildOperationsScenario();
const assessment = assessWorkloads(buildScenarioWorkloads(model), [], model);
const job = assessment.decisions.find((item) => item.recommended)!;
describe("compute visual contracts", () => {
  it("keeps nominal candidate power distinct from required response and feasibility", () => {
    const s = selectComputeSummary(assessment, model);
    expect(s).toMatchObject({
      total: 5,
      eligible: 4,
      candidates: 1,
      required: 3.6,
      nominal: 7,
      status: "Schedule validation required",
    });
    expect(s.unrecovered).toBeGreaterThan(0);
  });
  it("preserves full-horizon screening when the chart is scoped", () => {
    expect(selectComputeSummary(assessment, scopeOperationsModel(model, "now"))).toEqual(
      selectComputeSummary(assessment, model),
    );
  });
  it.each([
    [0, 0, 0, "No workload movement required"],
    [4, 0, 0, "No eligible candidate selected"],
    [4, 1, 2, "Nominal candidate power is insufficient"],
  ])(
    "represents missing or insufficient candidates without a success claim",
    (required, candidates, nominal, status) => {
      expect(
        selectComputeSummary(
          {
            ...assessment,
            requiredWorkloadResponseMw: Number(required),
            recommendedJobs: Number(candidates),
            recommendedPowerMw: Number(nominal),
          },
          model,
        ).status,
      ).toBe(status);
    },
  );
  it("does not turn missing recovery evidence into zero", () => {
    expect(selectComputeSummary(assessment, { ...model, summaries: [] }).unrecovered).toBeNull();
  });
  it("clips windows to the viewport, preserving continuation", () => {
    const start = Date.parse(job.earliestStart);
    const w = workloadWindow(job, start + 60_000, start + 120_000)!;
    expect(w.declared).toMatchObject({ left: 0, width: 100, before: true, after: true });
  });
  it("identifies jobs entirely outside the visible window", () => {
    const end = Date.parse(job.deadline);
    const w = workloadWindow(job, end + 60_000, end + 120_000)!;
    expect(w.declared).toBeNull();
    expect(w.proposed).toBeNull();
    expect(w.deadline).toBeNull();
  });
  it("rejects invalid dates and zero ranges instead of drawing imaginary bars", () => {
    expect(workloadWindow({ ...job, deadline: "bad" }, 1, 2)).toBeNull();
    expect(workloadWindow(job, 2, 2)).toBeNull();
  });
  it("flags proposed completion beyond deadline", () => {
    const deadline = Date.parse(job.deadline);
    expect(
      workloadWindow({ ...job, proposedStart: job.deadline }, deadline - 60_000, deadline + 60_000)
        ?.missesDeadline,
    ).toBe(true);
  });
});
