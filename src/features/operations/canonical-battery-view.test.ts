import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { selectCanonicalBatteryView } from "./canonical-battery-view";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanonicalBatteryInspector } from "./CanonicalBatteryInspector";

function fixture() {
  const request = buildSyntheticMilpRequest(defaultOperationsScenario);
  return { request, job: canonicalMilpJob(request) };
}
describe("canonical battery workspace projection", () => {
  it("retains accepted identity and reconciles the no-generation power path", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    const before = JSON.stringify(a);
    const m = selectCanonicalBatteryView(a, a.points[2].timestamp);
    expect(m.flow?.inputDifferenceMw).toBe(0);
    expect(m.audit?.capacity).toBeCloseTo(76.8);
    expect(m.energyAboveReserveMwh).toBeCloseTo(44.544);
    expect(m.minimumSoc).toBeCloseTo(78);
    expect(m.segments.reduce((sum, segment) => sum + segment.minutes, 0)).toBe(1440);
    expect(JSON.stringify(a)).toBe(before);
  });
  it("does not draw an invented generation flow or assume missing terminal diagnostics passed", () => {
    const { request, job } = fixture();
    job.result_payload.result.facility.points.forEach(point => { point.onsite_generation_mw = 1; point.grid_import_mw = 50; });
    const a = selectCanonicalPresentation(job, request);
    delete (a.projected.assessment as Record<string, unknown>).battery_terminal_targets_met;
    const m = selectCanonicalBatteryView(a, a.points[0].timestamp);
    expect(m.flow).toBeNull();
    expect(m.components.find(component => component.label === "Onsite generation")?.value).toBe(1);
    expect(m.facts.terminalTargetsMet).toBeNull();
    expect(m.terminal?.state).toBe("unavailable");
    const html = renderToStaticMarkup(createElement(CanonicalBatteryInspector, { model: m }));
    expect(html).toContain("Check unavailable");
    expect(html).not.toContain("Met within model");
  });
  it("separates signed dispatch, AC integration and DC state using variable durations", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    // Selector-level trajectory sample; no second dispatch calculation is performed.
    a.points[0] = { ...a.points[0], durationMinutes: 30, batteryPowerMw: -4 };
    a.points[1] = { ...a.points[1], durationMinutes: 15, batteryPowerMw: 2 };
    const m = selectCanonicalBatteryView(a, a.points[0].timestamp);
    expect(m.chargeMwh).toBe(2);
    expect(m.dischargeMwh).toBe(.5);
    expect(m.selected.batteryPowerMw).toBe(-4);
    expect(m.events.find(event => event.label === "First charge")?.point?.timestamp).toBe(a.points[0].timestamp);
  });
  it("keeps the no-battery state explicit", () => {
    const { request } = fixture();
    request.batteries = [];
    const a = selectCanonicalPresentation(canonicalMilpJob(request), request);
    const m = selectCanonicalBatteryView(a, a.points[0].timestamp);
    expect(m.reserveProtected).toBeNull();
    expect(m.minimumSoc).toBeNull();
    expect(m.energyAboveReserveMwh).toBeNull();
    expect(m.accounting).toBeNull();
    expect(m.terminal).toBeNull();
    const html = renderToStaticMarkup(createElement(CanonicalBatteryInspector, { model: m }));
    expect(html).toContain("No battery in this plan");
    expect(html).not.toContain("Energy accounting");
  });
  it("projects accepted AC interval energy and DC states without substituting one for the other", () => {
    const { request, job } = fixture();
    const asset = request.batteries![0];
    const dt = Number(request.intervals[0].duration_minutes) / 60;
    const initial = Number(asset.initial_soc_mwh);
    const gain = 4 * dt * Number(asset.charge_efficiency);
    const discharge = gain * Number(asset.discharge_efficiency) / dt;
    Object.assign(job.result_payload.result.facility.points[0], { battery_charge_mw: 4, grid_import_mw: 55 });
    Object.assign(job.result_payload.result.facility.points[1], { battery_discharge_mw: discharge, grid_import_mw: 51 - discharge });
    job.result_payload.result.battery_trajectories[0].points.forEach((point, i) => { point.soc_mwh = initial + (i === 0 ? gain : 0); });
    const a = selectCanonicalPresentation(job, request);
    const before = JSON.stringify(a);
    const charging = selectCanonicalBatteryView(a, a.points[0].timestamp);
    const discharging = selectCanonicalBatteryView(a, a.points[1].timestamp);
    expect(charging.direction).toBe("Charging");
    expect(charging.accounting?.acChargeMwh).toBe(4 * dt);
    expect(charging.accounting?.storedEndMwh).toBeCloseTo(initial + gain);
    expect(charging.accounting?.storedStartMwh).toBeCloseTo(initial);
    expect(discharging.direction).toBe("Discharging");
    expect(discharging.accounting?.acDischargeMwh).toBeCloseTo(discharge * dt);
    expect(discharging.accounting?.storedStartMwh).toBeCloseTo(initial + gain);
    expect(discharging.accounting?.storedEndMwh).toBeCloseTo(initial);
    expect(charging.terminal).toEqual(discharging.terminal);
    expect(JSON.stringify(a)).toBe(before);
  });
  it("keeps negative, zero and positive margins distinct from full-horizon checks", () => {
    const { request, job } = fixture();
    const a = selectCanonicalPresentation(job, request);
    a.points[0].gridImportMw = a.limitMw + 2;
    a.points[1].gridImportMw = a.targetMw;
    const above = selectCanonicalBatteryView(a, a.points[0].timestamp);
    const at = selectCanonicalBatteryView(a, a.points[1].timestamp);
    expect(above.margins.facility).toBe(-2);
    expect(at.margins.safety).toBe(0);
    expect(at.margins.facility).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(CanonicalBatteryInspector, { model: above }));
    expect(html).toContain("Exceeds threshold");
    (a.projected.assessment as Record<string, unknown>).battery_terminal_targets_met = false;
    expect(selectCanonicalBatteryView(a, a.points[0].timestamp).terminal?.state).toBe("unresolved");
  });
});
