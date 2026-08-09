import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProject } from "./finder-project";
import {
  SYNTHETIC_FIXTURE_METADATA,
  SYNTHETIC_OPERATING_FACTORS,
  SYNTHETIC_VOLTAGE_RATING_MIDPOINT_MW,
} from "./synthetic-fixtures";

export const RELEASE_A_SCENARIO_VERSION = "de-bb-synthetic-capacity-v1";
export const RELEASE_A_MODEL_VERSION = "deterministic-hourly-profile-v1";

export type ScenarioEvidenceStatus = "synthetic" | "model_derived";

export type CapacityScoreComponent = {
  key:
    | "capacity_fit"
    | "voltage_fit"
    | "temporal_availability"
    | "distance"
    | "evidence"
    | "congestion"
    | "flexibility_burden"
    | "site_context";
  label: string;
  score: number;
  weight: number;
  contribution: number;
  explanation: string;
};

export type CapacityScenarioResult = {
  source: "synthetic_fixture";
  replaceBeforeProduction: true;
  fixtureVersion: string;
  candidateId: string;
  evidenceStatus: ScenarioEvidenceStatus;
  scenarioVersion: string;
  modelVersion: string;
  trainingStatus: "untrained";
  notForConnectionDecision: true;
  replacementTarget: string;
  requestedImportMw: number;
  requestedExportMw: number;
  firmImportEnvelopeMw: number;
  flexibleImportEnvelopeMw: number;
  syntheticExportEnvelopeMw: number;
  p10FlexibleEnvelopeMw: number;
  p90FlexibleEnvelopeMw: number;
  constrainedHoursPerYear: number;
  preFlexConstrainedHoursPerYear: number;
  curtailedEnergyMwh: number;
  longestInterruptionHours: number;
  maximumReductionMw: number;
  batteryContributionMwh: number;
  limitingComponent: "transformer" | "upstream_branch" | "voltage_security" | "contingency";
  feasibleOnDeclaredInputs: boolean;
  score: number;
  scoreComponents: CapacityScoreComponent[];
  assumptions: string[];
  limitations: string[];
};

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function seededUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function baseRatingMw(voltageKv: number, seed: number) {
  const midpoint =
    voltageKv >= 380
      ? SYNTHETIC_VOLTAGE_RATING_MIDPOINT_MW[380]
      : voltageKv >= 220
        ? SYNTHETIC_VOLTAGE_RATING_MIDPOINT_MW[220]
        : voltageKv >= 110
          ? SYNTHETIC_VOLTAGE_RATING_MIDPOINT_MW[110]
          : SYNTHETIC_VOLTAGE_RATING_MIDPOINT_MW[20];
  return midpoint * (0.78 + seed * 0.44);
}

function loadFactor(project: FinderProject, hour: number) {
  const hourOfDay = hour % 24;
  const dayOfWeek = Math.floor(hour / 24) % 7;
  const month = Math.floor(hour / 730.5);
  const seasonal = 0.96 + 0.06 * Math.cos(((month - 1) / 12) * Math.PI * 2);
  if (project.loadProfile === "business_hours") {
    const open = dayOfWeek < 5 && hourOfDay >= 7 && hourOfDay < 19;
    return (open ? 0.98 : 0.52) * seasonal;
  }
  if (project.loadProfile === "managed_charging") {
    return (hourOfDay < 6 ? 0.92 : hourOfDay >= 17 && hourOfDay < 22 ? 0.48 : 0.66) * seasonal;
  }
  if (project.loadProfile === "flexible_process") {
    return (hourOfDay < 7 || hourOfDay >= 22 ? 0.72 : 0.9) * seasonal;
  }
  return (0.94 + 0.04 * Math.sin((hourOfDay / 24) * Math.PI * 2)) * seasonal;
}

function component(
  key: CapacityScoreComponent["key"],
  label: string,
  score: number,
  weight: number,
  explanation: string,
): CapacityScoreComponent {
  const bounded = round(clamp(score));
  return {
    key,
    label,
    score: bounded,
    weight,
    contribution: round((bounded * weight) / 100),
    explanation,
  };
}

export function calculateCapacityScenario(
  project: FinderProject,
  candidate: CandidateOpportunity,
): CapacityScenarioResult {
  const seed = seededUnit(`${RELEASE_A_SCENARIO_VERSION}:${candidate.nodeId}`);
  const voltageKv = Math.max(20, ...candidate.voltageKv);
  const targetYearDerate = clamp(
    1 - Math.max(0, project.targetEnergisationYear - 2026) * 0.01,
    0.72,
    1,
  );
  const rating = baseRatingMw(voltageKv, seed) * targetYearDerate;
  const limits = {
    transformer: rating * (0.58 + seed * 0.16),
    upstream_branch: rating * (0.62 + ((seed * 7) % 1) * 0.18),
    voltage_security: rating * (0.55 + ((seed * 13) % 1) * 0.2),
    contingency:
      rating *
      (project.redundancy === "n_minus_one"
        ? 0.48 + seed * 0.12
        : project.redundancy === "dual_feed"
          ? 0.55 + seed * 0.14
          : 0.68 + seed * 0.16),
  };
  const limitingComponent = (Object.entries(limits).sort(
    (left, right) => left[1] - right[1],
  )[0]?.[0] ?? "transformer") as CapacityScenarioResult["limitingComponent"];
  const firmEnvelope = Math.min(...Object.values(limits));
  const conditionalCeiling = Math.min(rating * 0.92, firmEnvelope * (1.2 + seed * 0.25));
  const requestedImport = Math.max(project.importMw, project.ultimateImportMw);
  const requestedExport = Math.max(0, project.exportMw);
  const bidirectionalRequirement = Math.max(requestedImport, requestedExport);
  const minimumFirm = Math.min(requestedImport, Math.max(0, project.minimumFirmMw));
  const flexibleLoad = Math.min(requestedImport, Math.max(0, project.flexibleLoadMw));
  const usableBatteryMwh =
    (project.batteryEnergyMwh * clamp(100 - project.batteryReservePct, 0, 100)) / 100;
  const batteryEfficiency = Math.sqrt(clamp(project.batteryRoundTripEfficiencyPct, 1, 100) / 100);
  let stateOfCharge = usableBatteryMwh * 0.5;
  let constrainedHours = 0;
  let preFlexConstrainedHours = 0;
  let curtailedEnergy = 0;
  let longestInterruption = 0;
  let currentInterruption = 0;
  let maximumReduction = 0;
  let batteryContribution = 0;
  const hourlyLimits: number[] = [];
  const annualAverageMw =
    project.annualConsumptionGwh > 0
      ? (project.annualConsumptionGwh * 1000) / 8760
      : requestedImport * 0.85;
  const annualEnergyScale = clamp(
    annualAverageMw / Math.max(0.1, requestedImport * 0.85),
    0.35,
    1.15,
  );

  for (let hour = 0; hour < 8760; hour += 1) {
    const hourOfDay = hour % 24;
    const seasonalGrid = 0.91 + 0.07 * Math.sin((hour / 8760) * Math.PI * 2 + seed * 4);
    const eveningStress =
      hourOfDay >= 17 && hourOfDay < 21 ? SYNTHETIC_OPERATING_FACTORS.eveningStress : 1;
    const operatingLimit = firmEnvelope * seasonalGrid * eveningStress;
    const flexibleLimit = Math.min(conditionalCeiling, operatingLimit * (1.08 + seed * 0.08));
    hourlyLimits.push(flexibleLimit);
    const demand =
      Math.max(minimumFirm, requestedImport * loadFactor(project, hour) * annualEnergyScale) -
      project.onsiteGenerationMw;
    let deficit = Math.max(0, demand - flexibleLimit);
    if (deficit > 0) preFlexConstrainedHours += 1;
    const loadResponse = Math.min(deficit, flexibleLoad);
    deficit -= loadResponse;
    const batteryResponse = Math.min(
      deficit,
      project.batteryPowerMw,
      stateOfCharge * batteryEfficiency,
    );
    stateOfCharge -= batteryResponse / batteryEfficiency;
    batteryContribution += batteryResponse;
    deficit -= batteryResponse;
    if (deficit > 0.001) {
      constrainedHours += 1;
      currentInterruption += 1;
      longestInterruption = Math.max(longestInterruption, currentInterruption);
      curtailedEnergy += deficit;
      maximumReduction = Math.max(maximumReduction, deficit);
    } else {
      currentInterruption = 0;
    }
    const surplus = Math.max(0, operatingLimit - demand);
    stateOfCharge = Math.min(
      usableBatteryMwh,
      stateOfCharge + Math.min(project.batteryPowerMw, surplus) * batteryEfficiency,
    );
  }

  const sortedLimits = [...hourlyLimits].sort((left, right) => left - right);
  const percentile = (p: number) => sortedLimits[Math.floor((sortedLimits.length - 1) * p)] ?? 0;
  const flexibleEnvelope = percentile(0.5);
  const voltageThreshold =
    project.preferredVoltageKv ??
    (bidirectionalRequirement >= 100 ? 220 : bidirectionalRequirement >= 20 ? 110 : 20);
  const voltageScore =
    voltageKv >= voltageThreshold ? 100 : voltageKv >= voltageThreshold / 2 ? 55 : 20;
  const syntheticExportEnvelope = flexibleEnvelope * (0.72 + seed * 0.12);
  const importFit = requestedImport > 0 ? (flexibleEnvelope / requestedImport) * 100 : 100;
  const exportFit = requestedExport > 0 ? (syntheticExportEnvelope / requestedExport) * 100 : 100;
  const capacityFit = Math.min(importFit, exportFit);
  const temporalScore = 100 - constrainedHours / 87.6;
  const congestionScore = 100 - preFlexConstrainedHours / 87.6;
  const flexibilityBurden =
    requestedImport > 0 ? 100 - ((flexibleLoad + maximumReduction) / requestedImport) * 100 : 100;
  const components = [
    component(
      "capacity_fit",
      "Synthetic capacity fit",
      capacityFit,
      25,
      "Compares the requested import with the modelled hourly envelope.",
    ),
    component(
      "voltage_fit",
      "Voltage and scale",
      voltageScore,
      15,
      `Screens ${requestedImport} MW against mapped ${voltageKv} kV context.`,
    ),
    component(
      "temporal_availability",
      "Temporal availability",
      temporalScore,
      15,
      `${constrainedHours} modelled constrained hours after declared flexibility.`,
    ),
    component(
      "distance",
      "Distance",
      100 - candidate.distanceKm * 5,
      10,
      `${candidate.distanceKm} km straight-line screening distance.`,
    ),
    component(
      "evidence",
      "Evidence quality",
      candidate.evidenceScore,
      10,
      "Uses accepted public-source evidence completeness.",
    ),
    component(
      "congestion",
      "Operating stress",
      congestionScore,
      10,
      `${preFlexConstrainedHours} hours exceed the synthetic envelope before flexibility.`,
    ),
    component(
      "flexibility_burden",
      "Flexibility burden",
      flexibilityBurden,
      10,
      "Penalises reliance on curtailment and customer-side flexibility.",
    ),
    component(
      "site_context",
      "Site context",
      candidate.contextScore,
      5,
      "Retains mapped infrastructure and site evidence context.",
    ),
  ];
  const score = round(components.reduce((sum, item) => sum + item.contribution, 0));
  const feasible =
    constrainedHours <= project.annualInterruptionLimit &&
    longestInterruption <= project.maxInterruptionHours &&
    firmEnvelope >= minimumFirm;

  return {
    ...SYNTHETIC_FIXTURE_METADATA,
    candidateId: candidate.id,
    evidenceStatus: "synthetic",
    scenarioVersion: RELEASE_A_SCENARIO_VERSION,
    modelVersion: RELEASE_A_MODEL_VERSION,
    trainingStatus: "untrained",
    notForConnectionDecision: true,
    replacementTarget:
      "DSO/TSO planning model, asset ratings, operational loading and connection queue",
    requestedImportMw: round(requestedImport),
    requestedExportMw: round(requestedExport),
    firmImportEnvelopeMw: round(firmEnvelope),
    flexibleImportEnvelopeMw: round(flexibleEnvelope),
    syntheticExportEnvelopeMw: round(syntheticExportEnvelope),
    p10FlexibleEnvelopeMw: round(percentile(0.1)),
    p90FlexibleEnvelopeMw: round(percentile(0.9)),
    constrainedHoursPerYear: constrainedHours,
    preFlexConstrainedHoursPerYear: preFlexConstrainedHours,
    curtailedEnergyMwh: round(curtailedEnergy),
    longestInterruptionHours: longestInterruption,
    maximumReductionMw: round(maximumReduction),
    batteryContributionMwh: round(batteryContribution),
    limitingComponent,
    feasibleOnDeclaredInputs: feasible,
    score,
    scoreComponents: components,
    assumptions: [
      `Synthetic equipment ratings inferred from mapped ${voltageKv} kV context.`,
      `Deterministic hourly profile ${project.loadProfile}; target year ${project.targetEnergisationYear}.`,
      `${flexibleLoad} MW interruptible load, ${project.batteryPowerMw} MW / ${project.batteryEnergyMwh} MWh battery and ${project.onsiteGenerationMw} MW on-site generation declared.`,
    ],
    limitations: [
      "No operator asset ratings, SCADA loading, protection, fault-level or connection-queue data are used.",
      "The hourly profile is an untrained deterministic scenario, not a forecast of actual network operation.",
      "The result is not available or connectable capacity and cannot support an investment or connection decision.",
    ],
  };
}

export function applyReleaseAScenarios(project: FinderProject, candidates: CandidateOpportunity[]) {
  return candidates
    .map((candidate) => {
      const capacityScenario = calculateCapacityScenario(project, candidate);
      return { ...candidate, screeningRank: capacityScenario.score, capacityScenario };
    })
    .sort(
      (left, right) =>
        right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
    );
}
