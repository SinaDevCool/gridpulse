import {
  buildConnectionOptions,
  rankConnectionOptions,
} from "../features/grid-connection/connection-options";
import type { IntervalPoint } from "./fca-engine";

export const validationCaseTruth = {
  id: "DE-DC-VALIDATION-01",
  label: "Synthetic German data-centre validation case",
  disclaimer:
    "All locations, limits and operating assumptions are synthetic planning inputs. No network capacity, operator support or connection date is claimed.",
  methodologyVersion: "de-validation-case-v1",
};

export const validationCandidates = [
  {
    name: "Frankfurt region candidate",
    region: "Hesse",
    likelyContext: "Amprion / local distribution responsibility to confirm",
    maturity: { land: "optioned", planning: "pre-application", route: "indicative" },
    evidenceStatus: "public context and customer assumptions",
    blocker: "Responsible operator, connection point and deliverable capacity unconfirmed",
  },
  {
    name: "Berlin-Brandenburg candidate",
    region: "Brandenburg",
    likelyContext: "50Hertz / distribution responsibility to confirm",
    maturity: { land: "controlled", planning: "pre-application", route: "indicative" },
    evidenceStatus: "public context and customer assumptions",
    blocker: "Node-level capacity and any allocation process unconfirmed",
  },
  {
    name: "Leipzig region candidate",
    region: "Saxony",
    likelyContext: "50Hertz / distribution responsibility to confirm",
    maturity: { land: "identified", planning: "not started", route: "unknown" },
    evidenceStatus: "public context only",
    blocker: "Site maturity and operator responsibility require validation",
  },
] as const;

export function createSyntheticAnnualDataCentreProfile(year = 2027): IntervalPoint[] {
  const start = Date.UTC(year, 0, 1);
  const intervals = 365 * 24 * 4;
  return Array.from({ length: intervals }, (_, index) => {
    const date = new Date(start + index * 15 * 60_000);
    const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
    const day = Math.floor(index / 96);
    const seasonalCooling = 5 * Math.max(0, Math.sin(((day - 100) / 365) * Math.PI * 2));
    const dailyCooling = 2.5 * Math.max(0, Math.sin(((hour - 8) / 24) * Math.PI * 2));
    const batchWorkload = hour >= 1 && hour < 5 ? 8 : 0;
    const deterministicVariation = ((index * 17) % 23) / 23;
    const importMw = 61 + seasonalCooling + dailyCooling + batchWorkload + deterministicVariation;
    return {
      timestamp: date.toISOString(),
      importMw: Math.round(importMw * 1000) / 1000,
      exportMw: 0,
      flexibleLoadMw: batchWorkload,
      onsiteGenerationMw: 0,
    };
  });
}

export function buildValidationCase() {
  const profile = createSyntheticAnnualDataCentreProfile();
  const options = rankConnectionOptions(
    buildConnectionOptions({
      requestedImportMw: 80,
      minimumViableImportMw: 55,
      reducedFirmImportMw: 50,
      conditionalImportMw: 20,
      operatorSupported: false,
      profile,
      dispatch: {
        minimumCriticalLoadMw: 55,
        shiftableLoadMw: 8,
        batteryPowerMw: 12,
        batteryEnergyMwh: 24,
        batteryRoundTripEfficiency: 0.9,
        batteryMinimumSoc: 0.1,
        initialBatterySoc: 1,
        energyValueEurMwh: 250,
        batteryDegradationEurMwh: 25,
      },
    }),
  );
  return {
    truth: validationCaseTruth,
    project: {
      requestedImportMw: 80,
      minimumViableImportMw: 55,
      targetDate: "Q4 2029 (customer hypothesis)",
      profileIntervals: profile.length,
      profileResolutionMinutes: 15,
      profileSource: "Deterministic synthetic reference profile",
    },
    candidates: validationCandidates,
    options,
    reviewQuestions: [
      "Are the operating constraints modelled in a way a German network operator can review?",
      "Which required technical inputs or application artifacts are missing?",
      "Are customer-controlled actions separated clearly from operator-controlled gates?",
      "Would this package reduce preparation time or clarification rounds?",
      "Which statement could be mistaken for a capacity or timing claim?",
    ],
  };
}
