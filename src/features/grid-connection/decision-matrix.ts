import type { ConnectionOptionResult } from "./connection-options";
import { buildOptionSensitivity, type OptionSensitivity } from "./option-sensitivity";

export type DecisionMatrixRow = ConnectionOptionResult & {
  evidenceReadiness: number;
  unresolvedGates: number;
  annualExposureEur: number | null;
  exposureSensitivity: OptionSensitivity;
  recommendation: "test_with_operator" | "develop_evidence" | "not_viable_on_inputs";
  nextAction: string;
};

export function buildDecisionMatrix(options: ConnectionOptionResult[]): DecisionMatrixRow[] {
  return options.map((option) => {
    const hasProfile = Boolean(option.analysis);
    const operatorConfirmed = option.evidenceStatus === "operator_supported";
    const fails = option.operationalStatus === "fails_minimum_viable_capacity";
    const unresolvedGates = option.operatorQuestions.length + (operatorConfirmed ? 0 : 1);
    const recommendation = fails
      ? "not_viable_on_inputs"
      : hasProfile
        ? "test_with_operator"
        : "develop_evidence";
    return {
      ...option,
      evidenceReadiness: Math.min(100, (hasProfile ? 55 : 20) + (operatorConfirmed ? 35 : 0)),
      unresolvedGates,
      annualExposureEur: option.analysis?.estimatedAnnualExposureEur ?? null,
      exposureSensitivity: buildOptionSensitivity(option),
      recommendation,
      nextAction: fails
        ? "Revise the minimum viable load or connection envelope."
        : !hasProfile
          ? "Upload and validate a representative interval load profile."
          : !operatorConfirmed
            ? `Ask the responsible operator: ${option.operatorQuestions[0]}`
            : "Record the operator conditions and advance to a controlled package.",
    };
  });
}
