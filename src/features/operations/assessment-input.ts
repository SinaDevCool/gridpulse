import { stableOperationsJson } from "../../lib/operations-request";
import { OPERATIONS_CALCULATION_VERSION } from "./calculation-version";
import type { AssessmentEvidence } from "./assessment-plan";
import type { OperationsScenario } from "./scenario-engine";

export function assessmentInput(scenario: OperationsScenario, evidence: AssessmentEvidence) {
  return {
    kind: "overview" as const,
    scenario,
    evidence: {
      ...evidence,
      workloads: evidence.workloads.filter((job) => job.source !== "scenario"),
    },
  };
}
export function assessmentQueryKey(input: ReturnType<typeof assessmentInput>) {
  return [
    "operations",
    "overview",
    OPERATIONS_CALCULATION_VERSION,
    stableOperationsJson(input),
  ] as const;
}
