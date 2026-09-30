import { describe, expect, it } from "vitest";
import { calculateStorageLcos } from "./storage-lcos";

describe("storage LCOS capital screen", () => {
  it("requires a complete declared capital scenario", () => {
    expect(calculateStorageLcos({ powerMw: null, durationHours: null, cyclesPerYear: null,
      roundTripEfficiencyPct: null, capexPowerEurPerKw: null, capexEnergyEurPerKwh: null,
      fixedOpexEurPerKwYear: null, variableOpexEurPerMwh: null,
      chargingEnergyPriceEurPerMwh: null, discountRatePct: null, economicLifeYears: null })).toBeNull();
  });
  it("calculates capital recovery without claiming operational delivery", () => {
    const result = calculateStorageLcos({ powerMw: 10, durationHours: 2, cyclesPerYear: 100,
      roundTripEfficiencyPct: 80, capexPowerEurPerKw: 100, capexEnergyEurPerKwh: 200,
      fixedOpexEurPerKwYear: 5, variableOpexEurPerMwh: 2,
      chargingEnergyPriceEurPerMwh: 50, discountRatePct: 0, economicLifeYears: 10 });
    expect(result?.energyMwh).toBe(20);
    expect(result?.annualDischargedMwh).toBe(2_000);
    expect(result?.lcosEurPerMwh).toBeGreaterThan(0);
  });
});
