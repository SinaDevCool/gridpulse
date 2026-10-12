import { describe, expect, it } from "vitest";
import {
  assessOperationsCompliance,
  assessOperationsQuality,
  authorizeDispatch,
  evaluateResponseEconomics,
  verifyOperationsResponse,
} from "./operations-assurance";

describe("operations assurance", () => {
  it("fails measured readiness closed when evidence is incomplete", () => {
    const result = assessOperationsQuality({
      expectedIntervals: 96,
      receivedIntervals: 80,
      newestEvidenceAt: "2026-10-06T10:00:00.000Z",
      assessedAt: "2026-10-06T10:30:00.000Z",
      freshnessThresholdMinutes: 15,
      powerBalanceResidualPercent: 7,
    });
    expect(result.status).toBe("limited");
    expect(result.blockers).toHaveLength(3);
  });

  it("verifies delivered response net of rebound", () => {
    const result = verifyOperationsResponse({
      requestedReductionMw: 10,
      expectedImportMw: 90,
      actualImportMw: [90, 91],
      baselineImportMw: [100, 100],
      intervalMinutes: 15,
      batteryPowerMw: [5, 5],
      reboundImportMw: [102, 101],
      telemetryCompletenessPercent: 99,
    });
    expect(result.deliveredReductionMw).toBe(9.5);
    expect(result.netDeliveredEnergyMwh).toBe(4);
    expect(result.verified).toBe(true);
  });

  it("requires aligned energy before publishing measured PUE", () => {
    expect(
      assessOperationsCompliance({
        facilityEnergyMwh: 125,
        itEnergyMwh: 100,
        renewableSharePercent: 100,
        wasteHeatMwh: 10,
        heatTemperatureC: 35,
        measurementCoveragePercent: 99,
      }).measuredPue,
    ).toBe(1.25);
  });

  it("keeps economics downstream from feasibility", () => {
    const result = evaluateResponseEconomics({
      avoidedPeakMw: 5,
      durationHours: 2,
      energyPriceEurPerMwh: 100,
      capacityValueEurPerMw: 40,
      batteryEnergyMwh: 5,
      batteryDegradationEurPerMwh: 10,
      shiftedEnergyMwh: 2,
      workloadCostEurPerMwh: 20,
      flexibilityPaymentEur: 100,
      slaPenaltyEur: 0,
      baselineImportMw: [100, 100],
      proposedImportMw: [95, 105],
      intervalHours: [1, 1],
      intervalPricesEurPerMwh: [100, 100],
      billingPeakEvidenceReviewed: false,
    });
    expect(result.avoidedEnergyCostEur).toBe(0);
    expect(result.avoidedCapacityCostEur).toBe(0);
    expect(result.netValueEur).toBe(10);
  });

  it("keeps physical dispatch disabled unless every gate passes", () => {
    expect(
      authorizeDispatch({
        mode: "shadow",
        evidenceReady: true,
        connectorHealthy: true,
        agreementCurrent: true,
        approvalCount: 2,
        automaticDispatchEnabled: false,
      }).authorized,
    ).toBe(false);
    expect(
      authorizeDispatch({
        mode: "live",
        evidenceReady: true,
        connectorHealthy: true,
        agreementCurrent: true,
        approvalCount: 2,
        automaticDispatchEnabled: true,
      }).authorized,
    ).toBe(true);
  });
});
