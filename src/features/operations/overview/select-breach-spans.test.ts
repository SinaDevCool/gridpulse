import { describe, expect, it } from "vitest";
import { selectBreachSpans } from "./select-breach-spans";
import { buildOperationsScenario, defaultOperationsScenario } from "../scenario-engine";

describe("breach timeline projection", () => {
  it("matches assessment duration and does not mutate dispatch", () => {
    const model = buildOperationsScenario(defaultOperationsScenario);
    const before = JSON.stringify(model);
    const spans = selectBreachSpans(
      model.intervals,
      "baselineDemandMw",
      model.scenario.importLimitMw,
    );
    expect(spans.reduce((sum, span) => sum + span.minutes, 0) / 60).toBe(
      model.summaries[0].violationHours,
    );
    expect(JSON.stringify(model)).toBe(before);
  });
  it("preserves gaps and missing duration", () => {
    const template = buildOperationsScenario(defaultOperationsScenario).intervals[0];
    const points = [0, 10, 40, 50].map((minute, index) => ({
      ...template,
      timestamp: new Date(Date.UTC(2026, 8, 26, 0, minute)).toISOString(),
      durationMinutes: index === 3 ? undefined : 10,
      baselineDemandMw: 110,
    }));
    expect(selectBreachSpans(points, "baselineDemandMw", 100).map((span) => span.minutes)).toEqual([
      20, 10,
    ]);
    expect(selectBreachSpans([], "baselineDemandMw", 100)).toEqual([]);
    expect(selectBreachSpans(points, "baselineDemandMw", 110)).toEqual([]);
  });
});
