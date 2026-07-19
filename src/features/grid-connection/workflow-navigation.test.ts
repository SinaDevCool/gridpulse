import { describe, expect, it } from "vitest";
import { assessmentViews, stageForView, workflowStages } from "./workflow-navigation";

describe("assessment workflow navigation", () => {
  it("assigns every technical view to exactly one customer stage", () => {
    const assigned = workflowStages.flatMap((stage) => stage.views.map((view) => view.key));
    expect(assigned).toHaveLength(assessmentViews.length);
    expect(new Set(assigned).size).toBe(assessmentViews.length);
    expect(new Set(assigned)).toEqual(new Set(assessmentViews));
  });

  it("routes core views to the expected stage", () => {
    expect(stageForView("overview").key).toBe("screen");
    expect(stageForView("evidence").key).toBe("prepare");
    expect(stageForView("operator").key).toBe("engage");
    expect(stageForView("report").key).toBe("decide");
  });

  it("uses a view belonging to the stage as every default", () => {
    for (const stage of workflowStages) {
      expect(stage.views.some((view) => view.key === stage.defaultView)).toBe(true);
    }
  });
});
