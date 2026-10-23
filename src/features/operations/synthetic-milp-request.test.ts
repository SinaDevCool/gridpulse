import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { canonicalAssessmentFacts, canonicalPowerBalance } from "./canonical-overview";

describe("public synthetic MILP model", () => {
  it("produces one bounded explicit model without invoking the heuristic", () => {
    const request = buildSyntheticMilpRequest(defaultOperationsScenario);
    expect(request.intervals).toHaveLength(24);
    expect(request.intervals.every(interval => interval.duration_minutes === 60)).toBe(true);
    expect(request.workloads).toHaveLength(5);
    expect(request.requirement.truth_class).toBe("synthetic_demonstration");
    expect(request.requirement.operator_confirmed).toBe(false);
    expect(request.policy.solver_time_limit_seconds).toBe(30);
    expect(request.requirement.required_reduction_mw).toBe(0);
    expect(request.requirement.firm_limit_mw).toBe(defaultOperationsScenario.importLimitMw);
    expect(request.policy.operating_target_mw).toBe(defaultOperationsScenario.importLimitMw - defaultOperationsScenario.safetyReserveMw);
    expect((request.policy.event_intervals as boolean[]).filter(Boolean)).toHaveLength(3);
    expect((request.policy.event_intervals as boolean[])[0]).toBe(false);
    expect(request.batteries?.[0].terminal_target_mwh).toBe(request.batteries?.[0].initial_soc_mwh);
    expect(request.workloads[4].minimum_power_cap_mw).toBe(request.workloads[4].nominal_power_mw);
    // Remote cross-repository qualification consumes the exact browser-generated request.
    if (process.env.GRIDPULSE_MILP_REQUEST_OUTPUT) writeFileSync(process.env.GRIDPULSE_MILP_REQUEST_OUTPUT, JSON.stringify(request));
  });
  it("maps modified inputs while keeping PUE reference-only", () => {
    const a = buildSyntheticMilpRequest(defaultOperationsScenario);
    const b = buildSyntheticMilpRequest({ ...defaultOperationsScenario, gpuCount: 100000,
      gpuActivePowerWatts: 800, maximumDelayMinutes: 60, pue: 1.7 });
    expect(b.workloads[0].nominal_power_mw).not.toBe(a.workloads[0].nominal_power_mw);
    expect(b.workloads[0].maximum_start_delay_minutes).toBe(60);
    expect(b.facility.pue_assumption).toBe(1.7);
    expect(b.facility.cooling_load_factor).toBe(a.facility.cooling_load_factor);
  });
  it("supports a disabled battery without inventing an asset", () => {
    const request = buildSyntheticMilpRequest({ ...defaultOperationsScenario,
      battery: { ...defaultOperationsScenario.battery, available: false } });
    expect(request.batteries).toEqual([]);
  });
  it.skipIf(!process.env.GRIDPULSE_MILP_JOB_INPUT)("accepts the real hosted result into the shared three-tab projection", () => {
    const job: unknown = JSON.parse(readFileSync(process.env.GRIDPULSE_MILP_JOB_INPUT!, "utf8"));
    const assessment = selectCanonicalPresentation(job, buildSyntheticMilpRequest(defaultOperationsScenario));
    expect(assessment.points).toHaveLength(24);
    expect(assessment.jobs).toHaveLength(5);
    expect(assessment.projected.overview.identity).toBe(assessment.projected.compute.identity);
    expect(assessment.projected.compute.identity).toBe(assessment.projected.power.identity);
    expect(assessment.batteryAudit).not.toBeNull();
    expect(canonicalAssessmentFacts(assessment)).toEqual({ recoveryComplete: true,
      terminalTargetsMet: true, slaViolations: 0, importViolations: 0 });
    for (let index = 0; index < assessment.points.length; index++) {
      const balance = canonicalPowerBalance(assessment, index);
      expect(balance).not.toBeNull();
      expect(balance!.reconstructed).toBeCloseTo(balance!.actual, 4);
    }
    expect(assessment.points[0].startingSocPercent).toBeCloseTo(defaultOperationsScenario.battery.initialSocPercent);
    for (const point of assessment.points) {
      expect(point.socPercent).toBeGreaterThanOrEqual(assessment.protectedSocPercent - 1e-5);
      expect(point.socPercent).toBeLessThanOrEqual(assessment.batteryAudit!.maximumSocPercent + 1e-5);
    }
  });
});
