import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildSyntheticMilpRequest } from "./synthetic-milp-request";
import { defaultOperationsScenario } from "./scenario-engine";

describe("public synthetic MILP model", () => {
  it("produces one bounded explicit model without invoking the heuristic", () => {
    const request = buildSyntheticMilpRequest(defaultOperationsScenario);
    expect(request.intervals).toHaveLength(96);
    expect(request.workloads).toHaveLength(5);
    expect(request.requirement.truth_class).toBe("synthetic_demonstration");
    expect(request.requirement.operator_confirmed).toBe(false);
    expect(request.policy.solver_time_limit_seconds).toBe(30);
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
});
