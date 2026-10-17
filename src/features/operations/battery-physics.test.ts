import { describe, expect, it } from "vitest";
import { simulateBatteryDispatch, type BatteryConfiguration } from "./battery-dispatch";

const config: BatteryConfiguration = {
  maximumDischargePowerMw: 5,
  maximumChargePowerMw: 4,
  usableEnergyMwh: 10,
  initialSocPercent: 80,
  minimumSocPercent: 20,
  maximumSocPercent: 95,
  dischargeEfficiency: 0.8,
  chargeEfficiency: 0.9,
  stateOfHealthPercent: 80,
  rampRateMwPerMinute: 10,
  minimumDwellMinutes: 0,
  available: true,
  inverterAvailable: true,
};
const input = { timestamp: "2026-10-18T00:00:00Z", facilityDemandMw: 7, targetImportMw: 5 };

describe("battery numerical contract", () => {
  it("uses elapsed UTC time through Germany's repeated daylight-saving hour", () => {
    const points = simulateBatteryDispatch(
      [
        { ...input, timestamp: "2026-10-25T02:00:00+02:00" },
        { ...input, timestamp: "2026-10-25T02:00:00+01:00" },
      ],
      config,
      15,
    );
    expect(points[0].durationMinutes).toBe(60);
    expect(points[0].endingEnergyMwh).toBeCloseTo(3.9, 12);
  });
  it("maintains an independent energy ledger across seeded mixed-demand trajectories", () => {
    let seed = 20261018;
    const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
    for (let trial = 0; trial < 40; trial++) {
      const settings = {
        ...config,
        usableEnergyMwh: 0.1 + random() * 20,
        stateOfHealthPercent: 20 + random() * 80,
        dischargeEfficiency: 0.5 + random() * 0.5,
        chargeEfficiency: 0.5 + random() * 0.5,
        rampRateMwPerMinute: 0.01 + random(),
        minimumDwellMinutes: Math.floor(random() * 30),
      };
      const points = simulateBatteryDispatch(
        Array.from({ length: 96 }, (_, index) => ({
          ...input,
          timestamp: new Date(Date.UTC(2026, 9, 18, 0, 15 * index)).toISOString(),
          facilityDemandMw: random() * 10,
        })),
        settings,
        15,
      );
      const capacity = (settings.usableEnergyMwh * settings.stateOfHealthPercent) / 100;
      let energy = (capacity * settings.initialSocPercent) / 100;
      for (const point of points) {
        energy +=
          point.batteryPowerMw >= 0
            ? -point.batteryPowerMw / settings.dischargeEfficiency / 4
            : (-point.batteryPowerMw * settings.chargeEfficiency) / 4;
        expect(point.endingEnergyMwh).toBeCloseTo(energy, 10);
        expect(point.socPercent).toBeGreaterThanOrEqual(settings.minimumSocPercent - 1e-9);
        expect(point.socPercent).toBeLessThanOrEqual(settings.maximumSocPercent + 1e-9);
        expect(point.gridImportMw + point.batteryPowerMw).toBeCloseTo(point.facilityDemandMw, 12);
      }
    }
  });
  it("matches hand-calculated AC discharge, reserve and degraded capacity", () => {
    const [point] = simulateBatteryDispatch([input], config, 60);
    // 10 MWh * 80% health = 8; initial 6.4; 2 MW AC consumes 2 / 0.8 MWh.
    expect(point.startingEnergyMwh).toBeCloseTo(6.4, 12);
    expect(point.endingEnergyMwh).toBeCloseTo(3.9, 12);
    expect(point.socPercent).toBeCloseTo(48.75, 12);
    expect(point.gridImportMw).toBe(5);
  });
  it("accounts for AC charging losses without exceeding the upper SOC", () => {
    const [point] = simulateBatteryDispatch([{ ...input, facilityDemandMw: 0 }], config, 60);
    expect(point.batteryPowerMw).toBeCloseTo(-1.2 / 0.9, 12);
    expect(point.endingEnergyMwh).toBeCloseTo(7.6, 12);
    expect(point.socPercent).toBeCloseTo(95, 12);
    expect(point.constraintCode).toBe("soc_maximum");
  });
  it("conserves interval energy and import balance with irregular durations", () => {
    const points = simulateBatteryDispatch(
      [
        input,
        { ...input, timestamp: "2026-10-18T00:15:00Z", facilityDemandMw: 3 },
        { ...input, timestamp: "2026-10-18T00:45:00Z", facilityDemandMw: 8 },
      ],
      config,
      15,
    );
    expect(points.map((p) => p.durationMinutes)).toEqual([15, 30, 15]);
    points.forEach((point, index) => {
      const change =
        point.batteryPowerMw >= 0
          ? ((-point.batteryPowerMw / config.dischargeEfficiency) * point.durationMinutes) / 60
          : (-point.batteryPowerMw * config.chargeEfficiency * point.durationMinutes) / 60;
      expect(point.endingEnergyMwh - point.startingEnergyMwh).toBeCloseTo(change, 12);
      expect(point.gridImportMw + point.batteryPowerMw).toBeCloseTo(point.facilityDemandMw, 12);
      expect(point.endingEnergyMwh).toBeGreaterThanOrEqual(1.6 - 1e-12);
      expect(point.endingEnergyMwh).toBeLessThanOrEqual(7.6 + 1e-12);
      if (index) expect(point.startingEnergyMwh).toBe(points[index - 1].endingEnergyMwh);
    });
  });
  it("does not round away small but real energy transfers", () => {
    const [point] = simulateBatteryDispatch([{ ...input, facilityDemandMw: 5.0017 }], config, 15);
    expect(point.batteryPowerMw).toBeCloseTo(0.0017, 12);
    expect(point.startingEnergyMwh - point.endingEnergyMwh).toBeCloseTo(0.0017 / 0.8 / 4, 12);
  });
  it.each([{ usableEnergyMwh: 0 }, { available: false }, { inverterAvailable: false }])(
    "never advertises or uses an unavailable discharge resource: %j",
    (change) => {
      const [point] = simulateBatteryDispatch([input], { ...config, ...change }, 15);
      expect(point.batteryPowerMw).toBe(0);
      expect(point.availableDischargeMw).toBe(0);
      expect(point.availableChargeMw).toBe(0);
      expect(point.shortfallMw).toBe(2);
    },
  );
  it("cannot bypass a direction dwell through an idle or blocked interval", () => {
    const points = simulateBatteryDispatch(
      Array.from({ length: 7 }, (_, index) => ({
        ...input,
        timestamp: new Date(Date.UTC(2026, 9, 18, 0, index)).toISOString(),
        facilityDemandMw: index === 0 ? 3 : index === 2 ? 5 : 7,
      })),
      { ...config, minimumDwellMinutes: 5 },
      1,
    );
    expect(points[0].batteryPowerMw).toBeLessThan(0);
    expect(points.slice(1, 5).every((point) => point.batteryPowerMw === 0)).toBe(true);
    expect(points[5].batteryPowerMw).toBeGreaterThan(0);
  });
  it.each([
    { dischargeEfficiency: 0 },
    { chargeEfficiency: 0 },
    { initialSocPercent: 10 },
    { maximumSocPercent: 70 },
    { maximumDischargePowerMw: -1 },
    { usableEnergyMwh: Infinity },
  ])("rejects invalid direct configurations: %j", (change) => {
    expect(() => simulateBatteryDispatch([input], { ...config, ...change }, 15)).toThrow();
  });
  it.each(["bad-date", "2026-10-18T00:00:00", "2026-99-18T00:00:00Z", "2026-10-18T00:00:00+99:00"])(
    "rejects ambiguous or invalid timestamps including the only/last interval: %s",
    (timestamp) => {
      expect(() => simulateBatteryDispatch([{ ...input, timestamp }], config, 15)).toThrow();
    },
  );
  it("rejects duplicate/reversed timestamps and nonfinite power without mutating inputs", () => {
    expect(() => simulateBatteryDispatch([input, input], config, 15)).toThrow(/chronological/);
    expect(() =>
      simulateBatteryDispatch([{ ...input, facilityDemandMw: NaN }], config, 15),
    ).toThrow();
    const before = structuredClone(config);
    simulateBatteryDispatch(
      Object.freeze([Object.freeze(input)]) as unknown as (typeof input)[],
      config,
      15,
    );
    expect(config).toEqual(before);
  });
});
