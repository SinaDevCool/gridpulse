import { describe, expect, it } from "vitest";
import { connectionEnvelopeError, germanDayIntervals, parseGermanPriceCsv } from "./german-planning";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { defaultGermanPlanning } from "./german-planning";

describe("German planning context", () => {
  it.each([["2026-03-29", 92], ["2026-09-26", 96], ["2026-10-25", 100]])("preserves elapsed time on %s", (date, count) => {
    const intervals = germanDayIntervals(date as string);
    expect(intervals).toHaveLength(count as number);
    expect(new Set(intervals.map(p => p.start)).size).toBe(count);
    const request = buildSyntheticMilpRequest(defaultOperationsScenario, { ...defaultGermanPlanning, enabled: true, localDate: date as string });
    expect(request.policy.event_intervals).toHaveLength(count as number);
    expect((request.policy.event_intervals as boolean[]).every(v => typeof v === "boolean")).toBe(true);
    expect(request.workloads.at(-1)?.expected_duration_minutes).toBe(Number(count) * 15);
  });
  it("requires aligned timestamped prices and preserves negative prices", () => {
    const intervals = germanDayIntervals("2026-10-25");
    const csv = "start_utc;end_utc;price_eur_per_mwh\n" + intervals.map(p => `${p.start};${new Date(Date.parse(p.start) + 900000).toISOString()};-10`).join("\n");
    expect(parseGermanPriceCsv(csv, intervals)).toEqual(Array(100).fill(-10));
    expect(() => parseGermanPriceCsv(csv.replace(intervals[0].start, intervals[1].start), intervals)).toThrow();
  });
  it("maps reviewed interval limits and restrictive battery permissions without changing component accounting", () => {
    const context = { ...defaultGermanPlanning, enabled: true, batteryFlexPermitted: false,
      importLimits: Array(96).fill(90), prices: Array(96).fill(-10),
      evidence: { source: "Reviewed contract", reviewedAt: "2026-09-25T00:00:00Z", basis: "operator_contract" as const } };
    const request = buildSyntheticMilpRequest(defaultOperationsScenario, context);
    expect(request.facility.import_limit_profile_mw).toEqual(Array(96).fill(90));
    expect(request.policy.operating_target_profile_mw).toEqual(Array(96).fill(88));
    expect(request.policy.allow_battery).toBe(false);
    expect(request.economics.import_price_eur_per_mwh).toEqual(Array(96).fill(-10));
    expect(request.planning_context?.pue_accounting).toBe("component_reference_only");
    expect(() => buildSyntheticMilpRequest(defaultOperationsScenario, { ...context, evidence: undefined })).toThrow();
    expect(() => buildSyntheticMilpRequest(defaultOperationsScenario, { ...context, importLimits: Array(96).fill(101) })).toThrow();
  });
});

describe("connection envelope input gate", () => {
  it("rejects incomplete, malformed and over-ceiling profiles before submission", () => {
    expect(connectionEnvelopeError("90 90", 96, 100)).toContain("96");
    expect(connectionEnvelopeError(Array(96).fill(101).join(" "), 96, 100)).toContain("ceiling");
    expect(connectionEnvelopeError("1..2", 96, 100)).toContain("nonnegative");
    expect(connectionEnvelopeError("", 96, 100)).toBe("");
    expect(connectionEnvelopeError(Array(100).fill(90).join(" "), 100, 100)).toBe("");
  });
});
