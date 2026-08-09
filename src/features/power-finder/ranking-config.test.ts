import { describe, expect, it } from "vitest";
import {
  baseRankingWeights,
  rankingSensitivity,
  validateRankingWeights,
  weightedInvestigationPriority,
} from "./ranking-config";

describe("versioned ranking configuration", () => {
  const components = {
    evidenceReadiness: 80,
    mappedVoltageRelevance: 60,
    proximity: 50,
    operatorAttribution: 100,
    sourceFreshness: 40,
  };
  it("is normalized and reproducible", () => {
    expect(validateRankingWeights(baseRankingWeights)).toEqual(baseRankingWeights);
    expect(weightedInvestigationPriority(components)).toBe(65.5);
  });
  it("reports sensitivity across customer profiles", () => {
    const result = rankingSensitivity(components);
    expect(result.scores).toHaveLength(6);
    expect(result.maximum).toBeGreaterThanOrEqual(result.minimum);
  });
});
