import {
  buildConnectionOptions,
  rankConnectionOptions,
} from "../grid-connection/connection-options";
import { buildDecisionMatrix, type DecisionMatrixRow } from "../grid-connection/decision-matrix";
import type { IntervalPoint } from "../../lib/fca-engine";
import {
  calculateCapacityScenario,
  syntheticProjectLoadFactor,
  type CapacityScenarioResult,
} from "./capacity-scenario";
import type { C1StudyPayload } from "./c1-study";
import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProject } from "./finder-project";
import type { ReleaseBNetworkResult } from "./release-b-network";
import { calculateReleaseBNetwork } from "./release-b-network";
import type { ValidationClass } from "./validation-class";

export type ActivationStudyMode =
  | "synthetic_demonstration"
  | "operator_model_unvalidated"
  | "operator_model_reconciled"
  | "operator_reviewed"
  | "operator_confirmed";

export type ActivationStudyContext = {
  mode: ActivationStudyMode;
  validationClass: ValidationClass;
  candidate: CandidateOpportunity;
  project: FinderProject;
  capacityScenario: CapacityScenarioResult | null;
  networkScenario: ReleaseBNetworkResult | null;
  registeredStudy: C1StudyPayload | null;
  options: ReturnType<typeof buildConnectionOptions>;
  decisionMatrix: DecisionMatrixRow[];
  recommendedOption: DecisionMatrixRow | null;
  permittedClaims: string[];
  prohibitedClaims: string[];
};

const operatorClasses = new Set<ActivationStudyMode>([
  "operator_model_unvalidated",
  "operator_model_reconciled",
  "operator_reviewed",
  "operator_confirmed",
]);

export function resolveActivationStudyMode(study: C1StudyPayload | null): ActivationStudyMode {
  if (!study?.node_study.available) return "synthetic_demonstration";
  const value = study.node_study.validation_class;
  return operatorClasses.has(value as ActivationStudyMode)
    ? (value as ActivationStudyMode)
    : "operator_model_unvalidated";
}

export function buildRepresentativeProfile(project: FinderProject, hours = 8760): IntervalPoint[] {
  const requested = Math.max(project.importMw, project.ultimateImportMw);
  const minimum = Math.min(requested, Math.max(0, project.minimumFirmMw));
  return Array.from({ length: hours }, (_, hour) => ({
    timestamp: new Date(Date.UTC(2026, 0, 5, hour)).toISOString(),
    importMw: Math.max(minimum, requested * syntheticProjectLoadFactor(project, hour)),
    exportMw: project.exportMw,
    flexibleLoadMw: project.flexibleLoadMw,
    onsiteGenerationMw: project.onsiteGenerationMw,
    connectionLimitFactor:
      (0.94 + 0.04 * Math.sin((hour / 8760) * Math.PI * 2)) *
      (hour % 24 >= 17 && hour % 24 < 21 ? 0.86 : 1),
  }));
}

export function createActivationStudyContext(input: {
  project: FinderProject;
  candidate: CandidateOpportunity;
  registeredStudy: C1StudyPayload | null;
}): ActivationStudyContext {
  const { project, candidate, registeredStudy } = input;
  const mode = resolveActivationStudyMode(registeredStudy);
  const capacityScenario =
    candidate.capacityScenario ?? calculateCapacityScenario(project, candidate);
  const networkScenario =
    candidate.networkScenario ?? calculateReleaseBNetwork(project, candidate, capacityScenario);
  const requested = Math.max(project.importMw, project.ultimateImportMw);
  const syntheticFirm =
    networkScenario?.selectedSecurityLimitMw ?? capacityScenario?.firmImportEnvelopeMw;
  const registeredFirm = registeredStudy?.node_study.result?.firm_import_capacity_mw;
  const firm = mode === "synthetic_demonstration" ? syntheticFirm : registeredFirm;
  // Public mode needs a bounded constraint in order to compare activation strategies. The
  // 65% floor is a versioned reference-case assumption, never a claim about the mapped node.
  const representativeFirm = requested * 0.65;
  const reducedFirm = Math.max(
    0,
    Math.min(
      requested,
      mode === "synthetic_demonstration" ? representativeFirm : (firm ?? project.minimumFirmMw),
    ),
  );
  const conditional = mode === "synthetic_demonstration" ? Math.max(0, requested - reducedFirm) : 0;
  const options = rankConnectionOptions(
    buildConnectionOptions({
      requestedImportMw: requested,
      minimumViableImportMw: Math.min(requested, Math.max(0, project.minimumFirmMw)),
      reducedFirmImportMw: reducedFirm,
      conditionalImportMw: conditional,
      operatorSupported: mode === "operator_confirmed",
      profile: buildRepresentativeProfile(project),
      dispatch: {
        minimumCriticalLoadMw: Math.min(requested, Math.max(0, project.minimumFirmMw)),
        shiftableLoadMw: Math.min(requested, Math.max(0, project.flexibleLoadMw)),
        batteryPowerMw: project.batteryPowerMw,
        batteryEnergyMwh: project.batteryEnergyMwh,
        batteryRoundTripEfficiency: project.batteryRoundTripEfficiencyPct / 100,
        batteryMinimumSoc: project.batteryReservePct / 100,
        initialBatterySoc: 1,
        energyValueEurMwh: 200,
        batteryDegradationEurMwh: 20,
      },
    }),
  );
  const decisionMatrix = buildDecisionMatrix(options);
  const recommendedOption = recommendActivationOption(decisionMatrix);
  return {
    mode,
    validationClass: mode,
    candidate,
    project,
    capacityScenario,
    networkScenario,
    registeredStudy,
    options,
    decisionMatrix,
    recommendedOption,
    permittedClaims:
      mode === "synthetic_demonstration"
        ? [
            "Compare representative activation strategies",
            "Identify evidence and operator questions",
          ]
        : ["Inspect the linked model result within its declared validation scope"],
    prohibitedClaims: [
      "A benchmark result is not available capacity at the mapped node.",
      "No result is a connection offer, reservation, cost or delivery date.",
    ],
  };
}

export function activationStatusLabel(status: DecisionMatrixRow["operationalStatus"]) {
  return {
    operationally_feasible: "Passes representative assumptions",
    operator_validation_required: "Candidate for operator investigation",
    feasible_with_constraints: "Residual operating constraints",
    insufficient_evidence: "Additional inputs required",
    fails_minimum_viable_capacity: "Below declared minimum",
  }[status];
}

export function recommendActivationOption(options: DecisionMatrixRow[]) {
  const candidates = options.filter((option) => option.kind !== "requested_firm");
  return (
    [...candidates].sort((left, right) => {
      const score = (option: DecisionMatrixRow) => {
        const analysis = option.analysis;
        const viable = option.operationalStatus === "fails_minimum_viable_capacity" ? -1000 : 0;
        const served = analysis?.demandServedPercent ?? 0;
        const residual = analysis?.residualUnservedMwh ?? 1_000_000;
        const restriction = analysis?.restrictedHours ?? 8_760;
        const activationBonus =
          option.kind === "storage_supported" ? 8 : option.kind.includes("flexible") ? 6 : 2;
        return viable + served * 2 - residual * 0.1 - restriction * 0.02 + activationBonus;
      };
      return score(right) - score(left);
    })[0] ?? null
  );
}

export type RepresentativeCommercialAssumptions = {
  valuePerEnergizedMwMonthEur: number;
  monthsAccelerated: number;
  flexibilityEnablementCostEur: number;
  batteryCapitalCostEurMwh: number;
};

export const defaultRepresentativeCommercialAssumptions: RepresentativeCommercialAssumptions = {
  valuePerEnergizedMwMonthEur: 50_000,
  monthsAccelerated: 12,
  flexibilityEnablementCostEur: 250_000,
  batteryCapitalCostEurMwh: 300_000,
};

export function calculateRepresentativeCommercialValue(
  context: ActivationStudyContext,
  assumptions = defaultRepresentativeCommercialAssumptions,
  selectedOption: DecisionMatrixRow | null = context.recommendedOption,
) {
  const option = selectedOption;
  const earlierMw = option ? Math.max(0, option.initialImportMw) : 0;
  const grossAccelerationValueEur =
    earlierMw * assumptions.monthsAccelerated * assumptions.valuePerEnergizedMwMonthEur;
  const batteryCostEur =
    option?.kind === "storage_supported"
      ? context.project.batteryEnergyMwh * assumptions.batteryCapitalCostEurMwh
      : 0;
  const flexibilityCostEur = option?.kind.includes("flexible")
    ? assumptions.flexibilityEnablementCostEur
    : 0;
  const operatingExposureEur = option?.annualExposureEur ?? 0;
  const netIndicativeValueEur =
    grossAccelerationValueEur - batteryCostEur - flexibilityCostEur - operatingExposureEur;
  return {
    earlierMw,
    grossAccelerationValueEur,
    batteryCostEur,
    flexibilityCostEur,
    operatingExposureEur,
    netIndicativeValueEur,
    lowIndicativeValueEur: netIndicativeValueEur * 0.5,
    highIndicativeValueEur: netIndicativeValueEur * 1.5,
    assumptions,
    boundary:
      "Representative customer-declared sensitivity only; it is not an investment return, operator offer, cost estimate or delivery commitment.",
  };
}

export function activationStudySnapshot(
  context: ActivationStudyContext,
  input?: {
    selectedOptionKind?: string | null;
    commercialAssumptions?: RepresentativeCommercialAssumptions | null;
  },
) {
  return {
    mode: context.mode,
    validation_class: context.validationClass,
    candidate_id: context.candidate.id,
    node_id: context.candidate.nodeId,
    scenario_version: context.capacityScenario?.scenarioVersion ?? null,
    network_version: context.networkScenario?.networkVersion ?? null,
    model_version: context.registeredStudy?.node_study.model?.version ?? null,
    option_kinds: context.options.map((option) => option.kind),
    recommended_option_kind: context.recommendedOption?.kind ?? null,
    selected_option_kind: input?.selectedOptionKind ?? context.recommendedOption?.kind ?? null,
    commercial_assumptions: input?.commercialAssumptions ?? null,
    recommended_option_summary: context.recommendedOption
      ? {
          initial_import_mw: context.recommendedOption.initialImportMw,
          eventual_import_mw: context.recommendedOption.eventualImportMw,
          restricted_hours: context.recommendedOption.analysis?.restrictedHours ?? null,
          residual_unserved_mwh: context.recommendedOption.analysis?.residualUnservedMwh ?? null,
        }
      : null,
    capacity_not_inferred: true,
    prohibited_claims: context.prohibitedClaims,
    captured_at: new Date().toISOString(),
  };
}
