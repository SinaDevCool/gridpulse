import type { CanonicalPresentation } from "./canonical-presentation";
import type { PowerBalanceStep } from "./overview/SignedResponseDiagram";

/** Presentation arithmetic only. No scheduling, optimisation or feasibility inference. */
export function canonicalPowerBalance(a: CanonicalPresentation, index: number) {
  const baseline = a.projected.overview.baseline[index];
  const planned = a.projected.overview.power[index];
  const steps: PowerBalanceStep[] = [{ label: "Baseline import", start: 0,
    end: baseline.grid_import_mw, value: baseline.grid_import_mw, total: true }];
  let running = baseline.grid_import_mw;
  const add = (label: string, value: number) => {
    steps.push({ label, start: running, end: running + value, value, total: false });
    running += value;
  };
  const fields = [["IT change", "it_power_mw", 1], ["Cooling change", "cooling_power_mw", 1],
    ["Auxiliary change", "auxiliary_power_mw", 1], ["Loss change", "losses_mw", 1],
    ["Generation change", "onsite_generation_mw", -1]] as const;
  for (const [label, key, sign] of fields) {
    const before = baseline[key], after = planned[key];
    if (typeof before !== "number" || !Number.isFinite(before) ||
        typeof after !== "number" || !Number.isFinite(after)) return null;
    const delta = sign * (after - before);
    if (Math.abs(delta) > 1e-8) add(label, delta);
  }
  // Baseline can include battery flows; subtract those before adding planned flows.
  add("Battery change", planned.battery_charge_mw - planned.battery_discharge_mw -
    baseline.battery_charge_mw + baseline.battery_discharge_mw);
  const net = (point: typeof planned) => Number(point.it_power_mw) + Number(point.cooling_power_mw) +
    Number(point.auxiliary_power_mw) + Number(point.losses_mw) - Number(point.onsite_generation_mw) +
    point.battery_charge_mw - point.battery_discharge_mw;
  const clipping = Math.max(0, -net(planned)) - Math.max(0, -net(baseline));
  if (Math.abs(clipping) > 1e-8) add("Export clipping", clipping);
  steps.push({ label: "Grid import", start: 0, end: planned.grid_import_mw,
    value: planned.grid_import_mw, total: true });
  return { steps, reconstructed: running, actual: planned.grid_import_mw };
}

export function canonicalBreachMinutes(a: CanonicalPresentation, baseline: boolean) {
  return a.points.reduce((minutes, point) => minutes +
    ((baseline ? point.baselineDemandMw! : point.gridImportMw) > a.limitMw + 0.01 ? point.durationMinutes! : 0), 0);
}

export function canonicalAssessmentFacts(a: CanonicalPresentation) {
  const result = a.projected.assessment;
  const flag = (key: string) => typeof result[key] === "boolean" ? result[key] as boolean : null;
  const count = (key: string) => typeof result[key] === "number" && Number.isFinite(result[key]) ? result[key] as number : null;
  return { recoveryComplete: flag("recovery_complete"), terminalTargetsMet: flag("battery_terminal_targets_met"),
    slaViolations: count("sla_violations"), importViolations: count("import_limit_violations") };
}
