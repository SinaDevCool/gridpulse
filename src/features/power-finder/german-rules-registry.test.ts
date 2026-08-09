import { describe, expect, it } from "vitest";
import { defaultFinderProject } from "./finder-project";
import { regulatoryQuestions, ruleReferencesForVoltage } from "./german-rules-registry";

describe("German connection rules registry", () => {
  it("routes medium and high-voltage evidence to the appropriate rule family", () => {
    expect(ruleReferencesForVoltage([20]).map((rule) => rule.id)).toContain("vde-ar-n-4110");
    expect(ruleReferencesForVoltage([110]).map((rule) => rule.id)).toContain("vde-ar-n-4120");
    expect(ruleReferencesForVoltage([380]).map((rule) => rule.id)).toContain("vde-ar-n-4130");
  });

  it("asks for operator confirmation rather than asserting capacity", () => {
    const questions = regulatoryQuestions(defaultFinderProject, [110]);
    expect(questions.join(" ")).toContain("written confirmation");
    expect(questions.join(" ")).not.toContain("available capacity is");
  });
});
