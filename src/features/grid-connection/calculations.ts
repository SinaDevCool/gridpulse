import type { FlexibilityInput, FlexibilityResult, SiteScreeningInput } from "./domain";

const round = (value: number) => Math.round(value * 1000) / 1000;

export function calculateMaturity(input: SiteScreeningInput) {
  const checks = [
    { key: "land", ready: input.landStatus === "controlled", weight: 25 },
    {
      key: "planning",
      ready: ["submitted", "approved"].includes(input.planningStatus),
      weight: 20,
    },
    { key: "single_line", ready: input.singleLineDiagramReady, weight: 20 },
    { key: "cable_route", ready: input.cableRouteStatus === "secured", weight: 20 },
    { key: "finance", ready: input.financeStatus === "committed", weight: 15 },
  ];
  return {
    score: checks.reduce((score, check) => score + (check.ready ? check.weight : 0), 0),
    checks,
    blockers: checks.filter((check) => !check.ready).map((check) => check.key),
  };
}

export function calculateFlexibility(input: FlexibilityInput): FlexibilityResult {
  const safe = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]),
  ) as unknown as FlexibilityInput;
  const availableDuringRestrictionMw = safe.firmImportMw + safe.conditionalImportMw;
  const grossShortfallMw = Math.max(0, safe.requestedImportMw - availableDuringRestrictionMw);
  const shiftableContributionMw = Math.min(grossShortfallMw, safe.shiftableLoadMw);
  const afterShiftMw = Math.max(0, grossShortfallMw - shiftableContributionMw);
  const batteryDurationHours = safe.batteryPowerMw
    ? safe.batteryEnergyMwh / safe.batteryPowerMw
    : 0;
  const durationFactor = safe.restrictionDurationHours
    ? Math.min(1, batteryDurationHours / safe.restrictionDurationHours)
    : 1;
  const batteryContributionMw = Math.min(afterShiftMw, safe.batteryPowerMw * durationFactor);
  const residualShortfallMw = Math.max(0, afterShiftMw - batteryContributionMw);
  const curtailedEnergyMwhPerEvent = residualShortfallMw * safe.restrictionDurationHours;
  const annualConstrainedEnergyMwh = curtailedEnergyMwhPerEvent * safe.restrictionEventsPerYear;
  const batteryThroughputMwh =
    batteryContributionMw * safe.restrictionDurationHours * safe.restrictionEventsPerYear;
  const estimatedAnnualExposureEur =
    annualConstrainedEnergyMwh * safe.energyValueEurMwh +
    batteryThroughputMwh * safe.batteryDegradationEurMwh;
  const criticalLoadCovered = safe.minimumCriticalLoadMw <= availableDuringRestrictionMw;
  const compatible = residualShortfallMw === 0 && criticalLoadCovered;
  const warnings = [
    !criticalLoadCovered
      ? "The declared firm and conditional envelope does not cover minimum critical load."
      : null,
    batteryDurationHours < safe.restrictionDurationHours && safe.batteryPowerMw > 0
      ? "Battery energy is insufficient to sustain its rated contribution for the full restriction."
      : null,
    safe.restrictionEventsPerYear === 0
      ? "Restriction frequency is unknown; annual exposure cannot be relied upon."
      : null,
    "This is customer-side planning analysis, not a network-operator connection offer.",
  ].filter((warning): warning is string => Boolean(warning));
  return {
    availableDuringRestrictionMw: round(availableDuringRestrictionMw),
    grossShortfallMw: round(grossShortfallMw),
    shiftableContributionMw: round(shiftableContributionMw),
    batteryContributionMw: round(batteryContributionMw),
    residualShortfallMw: round(residualShortfallMw),
    batteryDurationHours: round(batteryDurationHours),
    curtailedEnergyMwhPerEvent: round(curtailedEnergyMwhPerEvent),
    annualConstrainedEnergyMwh: round(annualConstrainedEnergyMwh),
    estimatedAnnualExposureEur: round(estimatedAnnualExposureEur),
    compatible,
    classification: compatible ? "requires_operator_study" : "commercially_unacceptable",
    warnings,
    calculationVersion: "de-fca-envelope-v2",
  };
}

export function canIssueOperatorPackage({
  evidenceReady,
  siteMaturityScore,
  hasLoadProfile,
}: {
  evidenceReady: boolean;
  siteMaturityScore: number;
  hasLoadProfile: boolean;
}) {
  const blockers = [
    !evidenceReady ? "Validate the minimum evidence set" : null,
    siteMaturityScore < 60 ? "Bring project maturity to at least 60%" : null,
    !hasLoadProfile ? "Add a representative interval load profile" : null,
  ].filter((item): item is string => Boolean(item));
  return { ready: blockers.length === 0, blockers };
}
