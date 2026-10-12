import { describe, expect, it } from "vitest";
import type { CandidateOpportunity } from "./candidate-intelligence";
import type { GridOperatorOption } from "./operator-catalog";
import { suggestOperatorFilters, suggestScreeningVoltage } from "./site-screening-context";

const candidate = (operator: string | null): CandidateOpportunity => ({
  id: "candidate-1",
  siteId: "site-1",
  nodeId: "node-1",
  siteName: "Site",
  nodeName: "Node",
  operator,
  voltageKv: [110],
  distanceKm: 2,
  contextScore: 80,
  evidenceScore: 70,
  screeningRank: 85,
  voltageFit: "compatible",
  confidence: "medium",
  missingEvidence: [],
  constraints: [],
  calculationVersion: "test",
  source: "database",
});

const option = (
  name: string,
  type: GridOperatorOption["type"],
  tsoNames: string[] = [],
): GridOperatorOption => ({ name, type, tsoNames, featureCount: 1, bounds: null });

describe("saved-site screening context", () => {
  it("suggests 110 kV for a 105 MW data-centre search", () => {
    expect(suggestScreeningVoltage(105, "data_centre")).toBe(110);
  });

  it("preserves an explicit accepted voltage preference", () => {
    expect(suggestScreeningVoltage(105, "data_centre", 220)).toBe(220);
  });

  it("uses an unambiguous DSO and its mapped TSO relationship", () => {
    const catalog = [option("Example DSO", "DSO / other", ["Example TSO"])];
    expect(suggestOperatorFilters(candidate("Example DSO"), catalog)).toEqual({
      dso: "Example DSO",
      tso: "Example TSO",
      basis: "candidate_dso",
    });
  });

  it("does not guess a TSO when a DSO relationship is ambiguous", () => {
    const catalog = [option("Example DSO", "DSO / other", ["TSO A", "TSO B"])];
    expect(suggestOperatorFilters(candidate("Example DSO"), catalog)).toEqual({
      dso: "Example DSO",
      tso: undefined,
      basis: "candidate_dso",
    });
  });
});
