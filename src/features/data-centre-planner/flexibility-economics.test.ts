import { describe, expect, it } from "vitest";
import { calculateFlexibilityEconomics } from "./flexibility-economics";

describe("flexibility economics", () => {
  it("fails closed while an economic input is missing", () => {
    expect(
      calculateFlexibilityEconomics({
        powerMw: 10,
        durationHours: 2,
        cyclesPerYear: 100,
        roundTripEfficiencyPct: 90,
        capexPowerEurPerKw: null,
        capexEnergyEurPerKwh: 100,
        fixedOpexEurPerKwYear: 5,
        variableOpexEurPerMwh: 1,
        chargingEnergyPriceEurPerMwh: 80,
        discountRatePct: 8,
        economicLifeYears: 15,
      }),
    ).toBeNull();
  });

  it("annualizes entered project costs and includes charging losses", () => {
    const result = calculateFlexibilityEconomics({
      powerMw: 10,
      durationHours: 2,
      cyclesPerYear: 100,
      roundTripEfficiencyPct: 80,
      capexPowerEurPerKw: 100,
      capexEnergyEurPerKwh: 200,
      fixedOpexEurPerKwYear: 5,
      variableOpexEurPerMwh: 2,
      chargingEnergyPriceEurPerMwh: 80,
      discountRatePct: 0,
      economicLifeYears: 10,
    });
    expect(result?.energyMwh).toBe(20);
    expect(result?.annualChargingMwh).toBe(2500);
    expect(result?.installedCostEur).toBe(5_000_000);
    expect(result?.annualizedCapexEur).toBe(500_000);
    expect(result?.lcosEurPerMwh).toBe(377);
  });
});
