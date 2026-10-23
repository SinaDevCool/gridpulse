import { describe, expect, it } from "vitest";
import { canonicalBatteryPresentation } from "./canonical-battery-presentation";

const config = { rated_energy_mwh: 80, degradation_fraction: .04, maximum_soc_fraction: .95,
  initial_soc_mwh: 59.904, minimum_reserve_mwh: 15.36, terminal_target_mwh: 59.904,
  charge_efficiency: .95, discharge_efficiency: .96 };
const state = (soc = 59.904, usable = 44.544) => ({ soc_mwh: soc, usable_energy_mwh: usable, available_power_mw: 5 });
const idle = { battery_charge_mw: 0, battery_discharge_mw: 0 };
describe("canonical battery presentation audit", () => {
  it("uses fixed health-adjusted capacity, never available energy above reserve", () => {
    const audit = canonicalBatteryPresentation(config, [state()], [idle], [60]);
    expect(audit.capacity).toBeCloseTo(76.8);
    expect(audit.points[0].soc_mwh / audit.capacity * 100).toBeCloseTo(78);
    expect(audit.initialSocPercent).toBeCloseTo(78);
    expect(audit.protectedSocPercent).toBeCloseTo(20);
    expect(audit.maximumSocPercent).toBe(95);
  });
  it("accepts a valid reserve-floor state with zero usable energy", () => {
    const audit = canonicalBatteryPresentation({ ...config, initial_soc_mwh: 15.36, terminal_target_mwh: 15.36 },
      [state(15.36, 0)], [idle], [60]);
    expect(audit.points[0].soc_mwh / audit.capacity * 100).toBeCloseTo(20);
  });
  it("checks charge/discharge efficiency, continuity and the terminal obligation", () => {
    const discharged = 59.904 - 4.8 / .96;
    const charged = discharged + 5 / .95 * .95;
    const audit = canonicalBatteryPresentation(config, [state(discharged), state(charged)],
      [{ battery_charge_mw: 0, battery_discharge_mw: 4.8 }, { battery_charge_mw: 5 / .95, battery_discharge_mw: 0 }], [60, 60]);
    expect(audit.points.at(-1)!.soc_mwh).toBeCloseTo(config.initial_soc_mwh);
    expect(() => canonicalBatteryPresentation(config, [state(discharged)],
      [{ battery_charge_mw: 0, battery_discharge_mw: 4.8 }], [60])).toThrow(/terminal/);
  });
  it("rejects impossible bounds and contradictory flows instead of clamping", () => {
    for (const soc of [80, 15, NaN, Infinity])
      expect(() => canonicalBatteryPresentation(config, [state(soc)], [idle], [60])).toThrow();
    expect(() => canonicalBatteryPresentation(config, [state()], [{ battery_charge_mw: 1, battery_discharge_mw: 1 }], [60])).toThrow();
    expect(() => canonicalBatteryPresentation(config, [state(60)], [idle], [60])).toThrow(/balance/);
  });
  it("includes backup reserve without changing the SOC capacity basis", () => {
    const audit = canonicalBatteryPresentation({ ...config, critical_load_mw: 24, backup_autonomy_minutes: 60 }, [state()], [idle], [60]);
    expect(audit.protectedSocPercent).toBeCloseTo(25 / 76.8 * 100);
    expect(audit.capacity).toBeCloseTo(76.8);
  });
});
