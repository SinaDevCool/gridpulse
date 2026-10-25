import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { selectCanonicalBatteryView } from "./canonical-battery-view";

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
  });
});
