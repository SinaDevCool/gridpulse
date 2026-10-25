import { describe, expect, it } from "vitest";
import { comparisonMaximum, peakChange } from "./overview-presentation";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PlanComparison } from "./PlanComparison";

describe("shared Overview presentation", () => {
  it("does not hide a negative improvement", () => {
    expect(peakChange(100, 105)).toEqual({ label: "Peak increased by", magnitude: 5 });
    expect(peakChange(117.2, 94.5).magnitude).toBeCloseTo(22.7);
    expect(peakChange(100, 100)).toEqual({ label: "Peak reduced by", magnitude: 0 });
  });
  it("includes all compared peaks and both limits in one common scale", () => {
    expect(comparisonMaximum([80, 51], 98, 100)).toBe(108);
    expect(comparisonMaximum([120, 51], 98, 100)).toBeCloseTo(129.6);
  });
  it("renders only supplied comparisons and retains engine-specific outcome content", () => {
    const html = renderToStaticMarkup(createElement(PlanComparison, { target: 98, limit: 100,
      peakLabel: "Peak import · full horizon", outcomeLabel: "Assessment", rows: [
        { id: "baseline", label: "Baseline", peakMw: 117.2, breachMinutes: 180, outcome: "Submitted reference" },
        { id: "joint", label: "Joint plan", peakMw: 94.5, breachMinutes: 0, outcome: "Replay passed" },
      ] }));
    expect(html).toContain("Replay passed");
    expect(html).not.toContain("Workload Only");
    expect(html).not.toContain("NaN");
    expect((html.match(/class="ops-peak-comparison"/g) ?? [])).toHaveLength(2);
  });
});
