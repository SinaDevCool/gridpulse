import { z } from "zod";

const finite = z.number().finite();
const stateSchema = z.object({ soc_mwh: finite.nonnegative(), usable_energy_mwh: finite.nonnegative(),
  available_power_mw: finite.nonnegative() });
const configSchema = z.object({ rated_energy_mwh: finite.positive(), degradation_fraction: finite.min(0).lt(1).default(0),
  maximum_soc_fraction: finite.positive().max(1).default(1), initial_soc_mwh: finite.nonnegative(),
  minimum_reserve_mwh: finite.nonnegative(), terminal_target_mwh: finite.nonnegative(),
  critical_load_mw: finite.nonnegative().default(0), backup_autonomy_minutes: finite.nonnegative().default(0),
  charge_efficiency: finite.positive().max(1), discharge_efficiency: finite.positive().max(1),
  self_discharge_fraction_per_hour: finite.min(0).lt(1).default(0) });

/** Presentation audit, not a second dispatch engine. Capacity is fixed; usable energy is headroom above reserve. */
export function canonicalBatteryPresentation(asset: unknown, states: unknown[],
  power: { battery_charge_mw: number; battery_discharge_mw: number }[], durations: number[]) {
  const config = configSchema.parse(asset);
  const points = states.map(point => stateSchema.parse(point));
  const capacity = config.rated_energy_mwh * (1 - config.degradation_fraction);
  const reserve = Math.max(config.minimum_reserve_mwh,
    config.critical_load_mw * config.backup_autonomy_minutes / 60 / config.discharge_efficiency);
  const ceiling = capacity * config.maximum_soc_fraction;
  const tolerance = Math.max(1e-5, capacity * 1e-7);
  if (config.initial_soc_mwh < reserve - tolerance || config.initial_soc_mwh > ceiling + tolerance)
    throw new Error("MILP battery initial energy is outside submitted bounds");
  points.forEach((point, index) => {
    const start = index ? points[index - 1].soc_mwh : config.initial_soc_mwh;
    const dt = durations[index] / 60;
    const flow = power[index];
    const expected = start * Math.max(0, 1 - config.self_discharge_fraction_per_hour * dt)
      + flow.battery_charge_mw * config.charge_efficiency * dt
      - flow.battery_discharge_mw / config.discharge_efficiency * dt;
    if (point.soc_mwh < reserve - tolerance || point.soc_mwh > ceiling + tolerance ||
      Math.abs(point.soc_mwh - expected) > tolerance ||
      (flow.battery_charge_mw > tolerance && flow.battery_discharge_mw > tolerance))
      throw new Error("MILP battery trajectory contradicts submitted energy bounds or balance");
  });
  if (points.at(-1)!.soc_mwh < config.terminal_target_mwh - tolerance)
    throw new Error("MILP battery terminal energy target is not met");
  return { points, capacity, reserve, initialSocPercent: config.initial_soc_mwh / capacity * 100,
    protectedSocPercent: reserve / capacity * 100, maximumSocPercent: config.maximum_soc_fraction * 100,
    terminalTargetMwh: config.terminal_target_mwh };
}
