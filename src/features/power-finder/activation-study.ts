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
import { evidenceStateForMode, type ActivationEvidenceState } from "./activation-evidence";
import type { ReferenceCapacityResult } from "./calculated-capacity";

export type ActivationStudyMode =
  | "synthetic_demonstration"
  | "reference_network_calculated"
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
  referenceCapacity: ReferenceCapacityResult | null;
  options: ReturnType<typeof buildConnectionOptions>;
  decisionMatrix: DecisionMatrixRow[];
  recommendedOption: DecisionMatrixRow | null;
  permittedClaims: string[];
  prohibitedClaims: string[];
  evidenceState: ActivationEvidenceState;
  hasViableOption: boolean;
  bestInvestigativeHypothesis: DecisionMatrixRow | null;
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
    // Demand shape is representative. Connection-option builders supply the
    // firm and conditional entitlement; a firm entitlement must not be
    // silently derated in every interval.
    connectionLimitFactor: 1,
  }));
}

export function createActivationStudyContext(input: {
  project: FinderProject;
  candidate: CandidateOpportunity;
  registeredStudy: C1StudyPayload | null;
  referenceCapacity?: ReferenceCapacityResult | null;
}): ActivationStudyContext {
  const { project, candidate, registeredStudy, referenceCapacity = null } = input;
  const mode = referenceCapacity
    ? "reference_network_calculated"
    : resolveActivationStudyMode(registeredStudy);
  const capacityScenario =
    candidate.capacityScenario ?? calculateCapacityScenario(project, candidate);
  const networkScenario =
    candidate.networkScenario ?? calculateReleaseBNetwork(project, candidate, capacityScenario);
  const requested = Math.max(project.importMw, project.ultimateImportMw);
  const syntheticFirm =
    networkScenario?.selectedSecurityLimitMw ?? capacityScenario?.firmImportEnvelopeMw;
  const registeredFirm = registeredStudy?.node_study.result?.firm_import_capacity_mw;
  const firm =
    referenceCapacity?.activation.conventional_firm_mw ??
    (mode === "synthetic_demonstration" ? syntheticFirm : registeredFirm);
  // Public mode needs a bounded constraint in order to compare activation strategies. The
  // 65% floor is a versioned reference-case assumption, never a claim about the mapped node.
  const representativeFirm = requested * 0.65;
  const reducedFirm = Math.max(
    0,
    Math.min(
      requested,
      mode === "synthetic_demonstration"
        ? representativeFirm
        : (referenceCapacity?.activation.conventional_firm_mw ?? firm ?? project.minimumFirmMw),
    ),
  );
  const conditional = referenceCapacity
    ? Math.max(0, Math.min(requested, referenceCapacity.activatable_capacity_mw) - reducedFirm)
    : mode === "synthetic_demonstration"
      ? Math.max(0, requested - reducedFirm)
      : 0;
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
  const bestInvestigativeHypothesis = rankInvestigativeHypotheses(decisionMatrix)[0] ?? null;
  return {
    mode,
    validationClass: mode,
    candidate,
    project,
    capacityScenario,
    networkScenario,
    registeredStudy,
    referenceCapacity,
    options,
    decisionMatrix,
    recommendedOption,
    permittedClaims:
      mode === "synthetic_demonstration" || mode === "reference_network_calculated"
        ? [
            "Compare representative activation strategies",
            "Identify evidence and operator questions",
          ]
        : ["Inspect the linked model result within its declared validation scope"],
    prohibitedClaims: [
      "A benchmark result is not available capacity at the mapped node.",
      "No result is a connection offer, reservation, cost or delivery date.",
    ],
    evidenceState: evidenceStateForMode(mode),
    hasViableOption: Boolean(recommendedOption),
    bestInvestigativeHypothesis,
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
  return (
    rankInvestigativeHypotheses(options).find(
      (option) =>
        option.analysis &&
        option.operationalStatus !== "fails_minimum_viable_capacity" &&
        option.operationalStatus !== "insufficient_evidence",
    ) ?? null
  );
}

export function rankInvestigativeHypotheses(options: DecisionMatrixRow[]) {
  const candidates = options.filter((option) => option.kind !== "requested_firm");
  return [...candidates].sort((left, right) => {
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
  });
}

export type RepresentativeCommercialAssumptions = {
  valuePerEnergizedMwMonthEur: number;
  monthsAccelerated: number;
  flexibilityEnablementCostEur: number;
  batteryCapitalCostEurMwh: number;
};

export const defaultRepresentativeCommercialAssumptions: RepresentativeCommercialAssumptions = {
  valuePerEnergizedMwMonthEur: 0,
  monthsAccelerated: 0,
  flexibilityEnablementCostEur: 0,
  batteryCapitalCostEurMwh: 0,
};

export function calculateRepresentativeCommercialValue(
  context: ActivationStudyContext,
  assumptions = defaultRepresentativeCommercialAssumptions,
  selectedOption: DecisionMatrixRow | null = context.recommendedOption,
) {
  const option = selectedOption;
  const eligible = Boolean(
    option &&
    option.analysis &&
    option.operationalStatus !== "fails_minimum_viable_capacity" &&
    option.operationalStatus !== "insufficient_evidence",
  );
  const earlierMw = eligible && option ? Math.max(0, option.initialImportMw) : 0;
  const grossAccelerationValueEur =
    earlierMw * assumptions.monthsAccelerated * assumptions.valuePerEnergizedMwMonthEur;
  const batteryCostEur =
    eligible && option?.kind === "storage_supported"
      ? context.project.batteryEnergyMwh * assumptions.batteryCapitalCostEurMwh
      : 0;
  const flexibilityCostEur =
    eligible && option?.kind.includes("flexible") ? assumptions.flexibilityEnablementCostEur : 0;
  const operatingExposureEur = eligible ? (option?.annualExposureEur ?? 0) : 0;
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
    eligible,
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
    reference_result: context.referenceCapacity
      ? {
          result_id: context.referenceCapacity.result_id,
          result_sha256: context.referenceCapacity.activation.result_sha256,
          conventional_firm_mw: context.referenceCapacity.activation.conventional_firm_mw,
          activatable_capacity_mw: context.referenceCapacity.activatable_capacity_mw,
          additional_unlocked_mw: context.referenceCapacity.additional_unlocked_mw,
          scenario_count: context.referenceCapacity.ensemble.scenario_count,
          hours_evaluated: context.referenceCapacity.ensemble.hours_evaluated,
          scenario_range_mw: context.referenceCapacity.ensemble.confidence,
          scenario_set_sha256: context.referenceCapacity.ensemble.scenario_set_sha256,
          release2_governance: context.referenceCapacity.release2_governance,
          release3_governance: context.referenceCapacity.release3_governance,
          restricted_hours: context.referenceCapacity.activation.flexible.restricted_hours,
          restricted_energy_mwh:
            context.referenceCapacity.activation.flexible.restricted_energy_mwh,
          validation_class: context.referenceCapacity.validation_state,
        }
      : null,
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
