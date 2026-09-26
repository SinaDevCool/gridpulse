import { describe, expect, it } from "vitest";
import {
  parseBatteryCsv,
  parseFacilityPowerCsv,
  simulateBatteryDispatch,
  type BatteryConfiguration,
} from "./battery-dispatch";

const config: BatteryConfiguration = {
  maximumDischargePowerMw: 5,
  maximumChargePowerMw: 4,
  usableEnergyMwh: 10,
  initialSocPercent: 80,
  minimumSocPercent: 20,
  maximumSocPercent: 95,
  dischargeEfficiency: 0.95,
  chargeEfficiency: 0.94,
  rampRateMwPerMinute: 1,
  minimumDwellMinutes: 15,
  stateOfHealthPercent: 100,
  available: true,
  inverterAvailable: true,
};

describe("battery dispatch", () => {
  it("uses positive power for discharge and respects power and SOC limits", () => {
    const result = simulateBatteryDispatch(
      [
        { timestamp: "2026-09-26T00:00:00.000Z", facilityDemandMw: 110, targetImportMw: 100 },
        { timestamp: "2026-09-26T00:15:00.000Z", facilityDemandMw: 110, targetImportMw: 100 },
      ],
      config,
      15,
    );
    expect(result[0].batteryPowerMw).toBe(5);
    expect(result[0].gridImportMw).toBe(105);
    expect(result[0].constraintCode).toBe("power_limited");
    expect(result[1].socPercent).toBeLessThan(result[0].socPercent);
    expect(result.every((point) => point.socPercent >= config.minimumSocPercent)).toBe(true);
  });

  it("uses negative power for charging and prevents dispatch when unavailable", () => {
    const charging = simulateBatteryDispatch(
      [{ timestamp: "2026-09-26T00:00:00.000Z", facilityDemandMw: 90, targetImportMw: 100 }],
      config,
      15,
    );
    expect(charging[0].batteryPowerMw).toBeLessThan(0);
    expect(charging[0].gridImportMw).toBeGreaterThan(90);
    const unavailable = simulateBatteryDispatch(
      [{ timestamp: "2026-09-26T00:00:00.000Z", facilityDemandMw: 110, targetImportMw: 100 }],
      { ...config, available: false },
      15,
    );
    expect(unavailable[0].batteryPowerMw).toBe(0);
    expect(unavailable[0].constraintCode).toBe("asset_unavailable");
  });

  it("parses real facility and battery records without filling absent optional values", () => {
    const facility = parseFacilityPowerCsv("timestamp,facility_import_mw\n2026-09-26T00:00:00Z,98");
    const battery = parseBatteryCsv(
      "timestamp,soc_percent,active_power_mw\n2026-09-26T00:00:00Z,72,3",
    );
    expect(facility[0]).toMatchObject({ facilityImportMw: 98, operatingLimitMw: null });
    expect(battery[0]).toMatchObject({ socPercent: 72, activePowerMw: 3, temperatureC: null });
  });
});
