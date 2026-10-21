import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "../scenario-engine";
import { scopeOperationsModel } from "../operating-context";
import { formatDurationHours } from "../formatting";
import { selectPlanObligations } from "./select-plan-obligations";

describe("full-horizon obligations projection", () => {
  it("preserves energy and does not confuse target compliance with completed work", () => {
    const model = buildOperationsScenario();
    for (const kind of ["workload", "battery_workload"] as const) {
      const s = selectPlanObligations(model, kind);
      expect(s.deferred).toBeCloseTo(s.recovered! + s.unresolved!, 1);
      expect(s.recoveryIncomplete).toBe(true);
      expect(s.recoveryRequired).toBe(true);
    }
    expect(selectPlanObligations(model, "baseline").recoveryRequired).toBe(false);
    expect(selectPlanObligations(model, "battery").recovered).toBe(0);
  });
  it("retains obligations when the chart inspects only the peak", () => {
    const full = buildOperationsScenario();
    const scoped = scopeOperationsModel(full, "now");
    expect(scoped.intervals).toHaveLength(1);
    expect(selectPlanObligations(full, "battery_workload").unresolved).toBe(
      scoped.summaries[2].unresolvedWorkMwh,
    );
    expect(selectPlanObligations(full, "battery_workload").deferred).toBeGreaterThan(
      scoped.recommendation.workloadMwh,
    );
  });
  it("uses explicit elapsed durations, including the final interval", () => {
    const model = buildOperationsScenario();
    model.intervals = model.intervals
      .slice(0, 2)
      .map((p, i) => ({ ...p, workloadShiftMw: 4, workloadRecoveryMw: i ? 2 : 0 }));
    model.planningTime!.intervals = model.intervals.map((p, i) => ({
      start: p.timestamp,
      end: new Date(Date.parse(p.timestamp) + (i ? 45 : 15) * 60_000).toISOString(),
    }));
    const s = selectPlanObligations(model, "battery_workload");
    expect(s.deferred).toBe(4);
    expect(s.recovered).toBe(1.5);
    expect(formatDurationHours(1.75)).toBe("1\u00a0h 45\u00a0min");
  });
  it("distinguishes unavailable results and failed reserve checks", () => {
    const model = buildOperationsScenario();
    model.intervals[0].batterySocPercent = 5;
    expect(selectPlanObligations(model, "battery").reserveFailed).toBe(true);
    model.intervals = [];
    const missing = selectPlanObligations(model, "battery_workload");
    expect(missing.available).toBe(false);
    expect(missing.unresolved).toBeNull();
    expect(missing.minSoc).toBeNull();
  });
});
