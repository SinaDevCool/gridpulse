import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "./scenario-engine";
import {
  derivePrimaryAlert,
  intervalsForWindow,
  operationalPue,
  scopeOperationsModel,
} from "./operating-context";

describe("operations operating context", () => {
  const model = buildOperationsScenario();

  it("uses one interval for now and sixteen intervals for the next four hours", () => {
    expect(intervalsForWindow(model.intervals, "now")).toHaveLength(1);
    expect(intervalsForWindow(model.intervals, "next-4h")).toHaveLength(16);
    expect(intervalsForWindow(model.intervals, "today")).toHaveLength(96);
  });

  it("recalculates summaries and recommendations inside the selected window", () => {
    const scoped = scopeOperationsModel(model, "next-4h");
    expect(scoped.intervals).toHaveLength(16);
    expect(scoped.summaries.every((summary) => summary.violationHours <= 4)).toBe(true);
    expect(scoped.recommendation.durationMinutes).toBeLessThanOrEqual(240);
  });

  it("turns scenario risk into a concise operational alert", () => {
    const alert = derivePrimaryAlert(model);
    expect(["normal", "watch", "action", "uncertain"]).toContain(alert.state);
    expect(alert.title.length).toBeGreaterThan(10);
    expect(alert.remainingRisk.length).toBeGreaterThan(5);
  });

  it("keeps configured PUE explicitly classified as an assumption", () => {
    expect(operationalPue(model)).toMatchObject({
      value: model.scenario.pue,
      evidence: "user_assumption",
      status: "Scenario assumption",
    });
  });
});
