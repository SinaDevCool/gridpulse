import { describe, expect, it } from "vitest";
import { defaultOperationsScenario } from "./scenario-engine";
import { mapCanonicalComponentInputs } from "./canonical-input-mapping";
import type { FacilityPlanRequest } from "../analytics/contracts";

const scenario = defaultOperationsScenario;
const calibration = {
  gpuModel: scenario.gpuModel, activeWatts: scenario.gpuActivePowerWatts,
  idleWatts: scenario.gpuIdlePowerWatts, shiftablePercent: scenario.maximumShiftablePercent,
};
function reviewed(): FacilityPlanRequest {
  return { schema_version: "gridpulse-facility-plan-request-v1", portfolio_id: "p",
    requirement: {}, intervals: [{}], facility: { networking_power_mw: 1, storage_power_mw: 2 },
    workloads: [{ workload_id: "job", maximum_start_delay_minutes: 60 }], profiles: [{}],
    policy: {}, economics: {}, cooling: {}, batteries: [{ resource_id: "b", terminal_target_mwh: 10 }],
  };
}
describe("reviewed component-mode input mapping", () => {
  it("maps battery energy once, preserves terminal policy and separates target from limit", () => {
    const input = reviewed();
    const mapped = mapCanonicalComponentInputs(scenario, input, calibration);
    expect(mapped.ready).toBe(true);
    expect(mapped.request?.facility.import_limit_mw).toBe(scenario.importLimitMw);
    expect(mapped.request?.policy.operating_target_mw).toBe(scenario.importLimitMw - scenario.safetyReserveMw);
    expect(mapped.request?.facility.fixed_auxiliary_power_mw).toBe(scenario.nonGpuBaseLoadMw - 3);
    expect(mapped.request?.batteries?.[0].terminal_target_mwh).toBe(10);
    expect(mapped.request?.batteries?.[0].initial_soc_mwh).toBe(
      scenario.battery.usableEnergyMwh * scenario.battery.stateOfHealthPercent / 100 * scenario.battery.initialSocPercent / 100,
    );
    expect(input.facility.import_limit_mw).toBeUndefined();
  });
  it("does not count PUE again as component overhead", () => {
    const mapped = mapCanonicalComponentInputs({ ...scenario, pue: 1.5 }, reviewed(), calibration);
    expect(mapped.request?.facility.pue_assumption).toBe(1.5);
    expect(mapped.request?.facility.cooling_load_factor).toBeUndefined();
    expect(mapped.warnings.join(" ")).toContain("PUE is a reference");
  });
  it("blocks unreviewed GPU calibration and ambiguous multiple-battery mapping", () => {
    expect(mapCanonicalComponentInputs(scenario, reviewed(), { ...calibration, activeWatts: -1 }).ready).toBe(false);
    const request = reviewed();
    request.batteries = [];
    expect(mapCanonicalComponentInputs(scenario, request, calibration).request).toBeNull();
  });
});
