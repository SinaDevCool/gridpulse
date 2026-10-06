import { describe, expect, it } from "vitest";
import { defaultOperationsScenario } from "./scenario-engine";
import { alignPowerEvidence, runOperationsAssessment } from "./operations-service";

describe("operations backend service", () => {
  it("returns a versioned read-only overview assessment", () => {
    const response = runOperationsAssessment({
      kind: "overview",
      scenario: defaultOperationsScenario,
    });
    expect(response.schemaVersion).toBe("gridpulse-operations-assessment-v1");
    expect(response.automaticDispatchAuthorized).toBe(false);
    expect(response.evidenceClass).toBe("simulated");
  });

  it("aligns independent meter and BMS clocks within tolerance", () => {
    const aligned = alignPowerEvidence(
      [{ timestamp: "2026-09-26T12:00:00.000Z", facilityImportMw: 98, operatingLimitMw: 100 }],
      [
        {
          timestamp: "2026-09-26T12:02:00.000Z",
          socPercent: 60,
          activePowerMw: 2,
          allowedDischargeMw: 5,
          allowedChargeMw: 5,
          stateOfHealthPercent: 96,
          temperatureC: 24,
          inverterState: "available",
          alarms: null,
        },
      ],
    );
    expect(aligned[0].battery?.socPercent).toBe(60);
  });

  it("rejects BMS observations outside the evidence tolerance", () => {
    const aligned = alignPowerEvidence(
      [{ timestamp: "2026-09-26T12:00:00.000Z", facilityImportMw: 98, operatingLimitMw: 100 }],
      [
        {
          timestamp: "2026-09-26T12:06:00.000Z",
          socPercent: 60,
          activePowerMw: 2,
          allowedDischargeMw: 5,
          allowedChargeMw: 5,
          stateOfHealthPercent: 96,
          temperatureC: 24,
          inverterState: "available",
          alarms: null,
        },
      ],
    );
    expect(aligned[0].battery).toBeNull();
  });

  it("returns one assurance result for quality, verification, compliance, economics and dispatch", () => {
    const response = runOperationsAssessment({
      kind: "assurance",
      quality: {
        expectedIntervals: 4, receivedIntervals: 4,
        newestEvidenceAt: "2026-10-06T10:00:00.000Z",
        assessedAt: "2026-10-06T10:05:00.000Z",
        powerBalanceResidualPercent: 1,
      },
      verification: null,
      compliance: {
        facilityEnergyMwh: 125, itEnergyMwh: 100, renewableSharePercent: 100,
        wasteHeatMwh: 10, heatTemperatureC: 35, measurementCoveragePercent: 100,
      },
      economics: {
        avoidedPeakMw: 5, durationHours: 1, energyPriceEurPerMwh: 100,
        capacityValueEurPerMw: 0, batteryEnergyMwh: 5,
        batteryDegradationEurPerMwh: 10, shiftedEnergyMwh: 0,
        workloadCostEurPerMwh: 0, flexibilityPaymentEur: 0, slaPenaltyEur: 0,
      },
      dispatch: {
        mode: "shadow", evidenceReady: true, connectorHealthy: true,
        agreementCurrent: true, approvalCount: 2, automaticDispatchEnabled: false,
      },
    });
    expect(response.result).toMatchObject({
      quality: { status: "ready" },
      compliance: { measuredPue: 1.25, evidenceReady: true },
      dispatch: { authorized: false, failClosed: true },
    });
  });
});
