import { describe, expect, it } from "vitest";
import { buildPowerBalancePresentation, buildPowerBalanceSankey, flowWidth } from "./power-balance";

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
    expect(
      buildPowerBalancePresentation({ facilityMw: 90, gridMw: 95, batteryMw: -5, gpuMw: 60 })
        .batteryDirection,
    ).toBe("charge");
    expect(
      buildPowerBalancePresentation({ facilityMw: 90, gridMw: 90, batteryMw: 0, gpuMw: 60 })
        .batteryDirection,
    ).toBe("idle");
    expect(
      buildPowerBalancePresentation({ facilityMw: 90, gridMw: 90, batteryMw: null, gpuMw: null })
        .batteryDirection,
    ).toBe("unavailable");
  });

  it("preserves the flow ratio without inventing a zero flow", () => {
    expect(flowWidth(100, 100)).toBe(22);
    expect(flowWidth(1, 100)).toBeCloseTo(0.22);
    expect(flowWidth(0, 100)).toBe(0);
  });
  it("routes charging to a destination and conserves every internal node", () => {
    for (const batteryMw of [-5, 0, 5]) {
      const data = buildPowerBalanceSankey(
        buildPowerBalancePresentation({
          facilityMw: 90,
          gridMw: 90 - batteryMw,
          batteryMw,
          gpuMw: 60,
        }),
      );
      expect(data.reconciled).toBe(true);
      data.nodes.forEach((node, index) => {
        const incoming = data.links
          .filter((link) => link.target === index)
          .reduce((sum, link) => sum + link.value, 0);
        const outgoing = data.links
          .filter((link) => link.source === index)
          .reduce((sum, link) => sum + link.value, 0);
        if (incoming && outgoing) expect(incoming).toBeCloseTo(outgoing);
        if (node.name === "Battery charging") expect(outgoing).toBe(0);
      });
    }
  });
  it("rejects missing or unreconciled evidence instead of drawing fictional flows", () => {
    expect(
      buildPowerBalanceSankey(
        buildPowerBalancePresentation({ facilityMw: 90, gridMw: 90, batteryMw: null, gpuMw: null }),
      ).links,
    ).toEqual([]);
    expect(
      buildPowerBalanceSankey(
        buildPowerBalancePresentation({ facilityMw: 90, gridMw: 90, batteryMw: 5, gpuMw: 100 }),
      ).reconciled,
    ).toBe(false);
  });
});
