import {
  buildConnectionOptions,
  rankConnectionOptions,
} from "../grid-connection/connection-options";
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

export function buildRepresentativeProfile(project: FinderProject, hours = 168): IntervalPoint[] {
  const requested = Math.max(project.importMw, project.ultimateImportMw);
  const minimum = Math.min(requested, Math.max(0, project.minimumFirmMw));
  return Array.from({ length: hours }, (_, hour) => ({
    timestamp: new Date(Date.UTC(2026, 0, 5, hour)).toISOString(),
    importMw: Math.max(minimum, requested * syntheticProjectLoadFactor(project, hour)),
    exportMw: project.exportMw,
    flexibleLoadMw: project.flexibleLoadMw,
    onsiteGenerationMw: project.onsiteGenerationMw,
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
  const reducedFirm = Math.max(0, Math.min(requested, firm ?? project.minimumFirmMw));
  const conditional =
    mode === "synthetic_demonstration"
      ? Math.max(0, capacityScenario.flexibleImportEnvelopeMw - reducedFirm)
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
        energyValueEurMwh: 0,
        batteryDegradationEurMwh: 0,
      },
    }),
  );
  return {
    mode,
    validationClass: mode,
    candidate,
    project,
    capacityScenario,
    networkScenario,
    registeredStudy,
    options,
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

export function activationStudySnapshot(context: ActivationStudyContext) {
  return {
    mode: context.mode,
    validation_class: context.validationClass,
    candidate_id: context.candidate.id,
    node_id: context.candidate.nodeId,
    scenario_version: context.capacityScenario?.scenarioVersion ?? null,
    network_version: context.networkScenario?.networkVersion ?? null,
    model_version: context.registeredStudy?.node_study.model?.version ?? null,
    option_kinds: context.options.map((option) => option.kind),
    capacity_not_inferred: true,
    prohibited_claims: context.prohibitedClaims,
    captured_at: new Date().toISOString(),
  };
}
