import { describe, expect, it } from "vitest";
import { buildPowerBalancePresentation, flowWidth } from "./power-balance";

describe("power balance presentation", () => {
  it("reconciles discharge inputs and facility loads", () => {
    const result = buildPowerBalancePresentation({
      facilityMw: 106.6,
      gridMw: 101.6,
      batteryMw: 5,
      gpuMw: 75.7,
    });
    expect(result).toMatchObject({
      batteryDirection: "discharge",
      otherMw: 30.9,
      inputDifferenceMw: 0,
      outputDifferenceMw: 0,
    });
  });

  it("represents charging, idle and unavailable battery evidence distinctly", () => {
    expect(buildPowerBalancePresentation({ facilityMw: 90, gridMw: 95, batteryMw: -5, gpuMw: 60 }).batteryDirection).toBe("charge");
    expect(buildPowerBalancePresentation({ facilityMw: 90, gridMw: 90, batteryMw: 0, gpuMw: 60 }).batteryDirection).toBe("idle");
    expect(buildPowerBalancePresentation({ facilityMw: 90, gridMw: 90, batteryMw: null, gpuMw: null }).batteryDirection).toBe("unavailable");
  });

  it("keeps proportional paths visible without inventing a zero flow", () => {
    expect(flowWidth(100, 100)).toBe(22);
    expect(flowWidth(1, 100)).toBeGreaterThanOrEqual(4);
    expect(flowWidth(0, 100)).toBe(0);
  });
});
