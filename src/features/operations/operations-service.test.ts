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
});
