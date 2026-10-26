import { describe, expect, it } from "vitest";
import { alternativeScenario } from "./alternative-plan";
import { defaultOperationsScenario } from "../scenario-engine";

describe("confirmed alternatives and knowledge", () => {
  it("changes energy without changing discharge power or the original", () => {
    const original = structuredClone(defaultOperationsScenario);
    const alternative = alternativeScenario(original, "batteryEnergy", original.battery.usableEnergyMwh / 2);
    expect(alternative.battery.usableEnergyMwh).toBe(original.battery.usableEnergyMwh / 2);
    expect(alternative.battery.maximumPowerMw).toBe(original.battery.maximumPowerMw);
    expect(original).toEqual(defaultOperationsScenario);
  });
  it("validates a changed import limit against existing reserve bounds", () => {
    expect(() => alternativeScenario(defaultOperationsScenario, "importLimit", 0)).toThrow();
  });
});
