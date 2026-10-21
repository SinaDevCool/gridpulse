import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "./scenario-engine";
import {
  derivePrimaryAlert,
  intervalsForWindow,
  operationalPue,
  scopeOperationsModel,
  describeDisplayWindow,
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

  it("keeps late-day risk inspection at four hours when coverage permits", () => {
    const points = model.intervals.map((point, i) => ({
      ...point,
      baselineDemandMw: i === 94 ? 110 : 90,
      combinedDemandMw: 90,
    }));
    const result = intervalsForWindow(points, "next-4h", 98);
    expect(result).toHaveLength(16);
    expect(result[0].label).toBe("20:00");
  });
  it("uses target breaches rather than response changes to locate risk", () => {
    const points = model.intervals.map((point, i) => ({
      ...point,
      baselineDemandMw: i === 60 ? 110 : 90,
      combinedDemandMw: i === 4 ? 85 : 90,
    }));
    expect(intervalsForWindow(points, "next-4h", 98)[0].label).toBe("14:00");
  });
  it("reports partial available coverage without fabricating intervals", () => {
    const short = { ...model, planningTime: undefined, intervals: model.intervals.slice(0, 6) };
    expect(describeDisplayWindow(short, "next-4h")).toContain("Partial coverage");
    expect(intervalsForWindow([], "now")).toEqual([]);
  });
  it("display filters preserve planning identity, SOC and full-horizon recovery", () => {
    const peak = scopeOperationsModel(model, "now");
    expect(peak.planningTime).toBe(model.planningTime);
    expect(peak.intervals[0]).toBe(
      model.intervals.find((point) => point.timestamp === peak.intervals[0].timestamp),
    );
    expect(peak.summaries[2].unresolvedWorkMwh).toBe(model.summaries[2].unresolvedWorkMwh);
  });
  it("integrates irregular durations from the full timeline, not the sliced final interval", () => {
    const irregular = {
      ...model,
      planningTime: undefined,
      intervals: model.intervals
        .slice(0, 3)
        .map((p, i) => ({
          ...p,
          timestamp: new Date(Date.UTC(2026, 8, 26, 0, [0, 30, 45][i])).toISOString(),
          baselineDemandMw: i === 0 ? 110 : 90,
        })),
    };
    const result = scopeOperationsModel(irregular, "now");
    expect(result.summaries[0].totalEnergyMwh).toBe(55);
    expect(result.summaries[0].violationHours).toBe(0.5);
  });
});
