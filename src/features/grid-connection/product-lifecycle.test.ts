import { describe, expect, it } from "vitest";
import { lifecycleStageForLocation } from "./product-lifecycle";

describe("global product lifecycle", () => {
  it("connects map discovery to qualification and evidence preparation", () => {
    expect(lifecycleStageForLocation("/power-finder", null)).toBe("discover");
    expect(lifecycleStageForLocation("/portfolio", null)).toBe("qualify");
    expect(lifecycleStageForLocation("/assessments/project", "evidence")).toBe("prepare");
  });

  it("connects operator execution, decisions and verified learning", () => {
    expect(lifecycleStageForLocation("/assessments/project", "execution")).toBe("engage");
    expect(lifecycleStageForLocation("/assessments/project", "report")).toBe("decide");
    expect(lifecycleStageForLocation("/pilot-case/project", null)).toBe("learn");
    expect(lifecycleStageForLocation("/reports", null)).toBe("learn");
  });
});
