import type { CanonicalPresentation } from "./canonical-presentation";
import { canonicalAssessmentFacts } from "./canonical-overview";
import { buildPowerBalancePresentation } from "./power-balance";
import { batteryConstraintSegments } from "./power/select-battery-workspace";

/** A projection of accepted replay values. Never dispatches or simulates a second plan. */
export function selectCanonicalBatteryView(a: CanonicalPresentation, timestamp: string) {
  const index = Math.max(0, a.points.findIndex(point => point.timestamp === timestamp));
  const selected = a.points[index];
  const audit = a.batteryAudit;
  const facts = canonicalAssessmentFacts(a);
  const energy = (sign: number) => a.points.reduce((sum, point) =>
    sum + Math.max(0, sign * (point.batteryPowerMw ?? 0)) * point.durationMinutes! / 60, 0);
  const states = a.points.map(point => {
    const dispatch = point.batteryPowerMw ?? 0;
    const direction = dispatch > .005 ? "Discharging" : dispatch < -.005 ? "Charging" : "Idle";
    const exceedance = point.gridImportMw > a.limitMw + .01 ? "Above facility limit" :
      point.gridImportMw > a.targetMw + .01 ? "Above safety target" : "Within safety target";
    return { ...point, constraintCode: `${direction}-${exceedance}`, constraintLabel: `${direction} · ${exceedance}` };
  });
  const minimum = audit ? a.points.reduce((best, point) => point.socPercent! < best.socPercent! ? point : best) : null;
  const events = [
    { label: "First discharge", point: a.points.find(point => (point.batteryPowerMw ?? 0) > .005) },
    { label: "First charge", point: a.points.find(point => (point.batteryPowerMw ?? 0) < -.005) },
    { label: "Minimum interval-end SOC", point: minimum },
    { label: "First target exceedance", point: a.points.find(point => point.gridImportMw > a.targetMw + .01) },
  ].filter(event => event.point != null);
  const raw = a.projected.power.power[index];
  const components = [
    ["IT load", raw.it_power_mw], ["Cooling", raw.cooling_power_mw],
    ["Auxiliary load", raw.auxiliary_power_mw], ["Electrical losses", raw.losses_mw],
    ["Onsite generation", raw.onsite_generation_mw],
  ].map(([label, value]) => ({ label: String(label), value: typeof value === "number" && Number.isFinite(value) ? value : null }));
  const generation = components.at(-1)!.value;
  const balance = buildPowerBalancePresentation({ facilityMw: selected.facilityDemandMw!,
    gridMw: selected.gridImportMw, batteryMw: selected.batteryPowerMw, gpuMw: null });
  const flowSupported = generation === 0 && balance.inputDifferenceMw != null && Math.abs(balance.inputDifferenceMw) <= .05;
  return { selected, index, audit, facts, segments: batteryConstraintSegments(states), events, components,
    flow: flowSupported ? balance : null,
    chargeMwh: energy(-1), dischargeMwh: energy(1),
    endSoc: audit ? a.points.at(-1)!.socPercent : null,
    minimumSoc: audit ? Math.min(audit.initialSocPercent, ...a.points.map(point => point.socPercent!)) : null,
    energyAboveReserveMwh: audit ? Math.max(0, audit.points[index].soc_mwh - audit.reserve) : null,
    reserveProtected: audit ? audit.points.every(point => point.soc_mwh + 1e-5 >= audit.reserve) : null,
    targetMet: a.points.every(point => point.gridImportMw <= a.targetMw + .01),
    peak: a.points.reduce((best, point) => point.gridImportMw > best.gridImportMw ? point : best).timestamp,
  };
}
export type CanonicalBatteryViewModel = ReturnType<typeof selectCanonicalBatteryView>;
