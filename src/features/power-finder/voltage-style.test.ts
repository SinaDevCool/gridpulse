import { describe, expect, it } from "vitest";
import { classifyGridVoltage, voltageClassFilter } from "./voltage-style";

describe("grid voltage styling", () => {
  it.each([
    [380, "ehv"],
    [220, "220kv"],
    [110, "110kv"],
    [20, "distribution"],
    [null, "unknown"],
  ])("classifies %s kV as %s", (voltage, expected) =>
    expect(classifyGridVoltage(voltage)?.id).toBe(expected),
  );

  it("builds deterministic filters for voltage isolation", () => {
    expect(voltageClassFilter("ehv")).toEqual([
      ">=",
      ["number", ["get", "max_voltage_kv"], 0],
      380,
    ]);
    expect(voltageClassFilter("unknown")).toEqual([
      "<=",
      ["number", ["get", "max_voltage_kv"], 0],
      0,
    ]);
    expect(voltageClassFilter(null)).toBeNull();
  });
});
