import { describe, expect, it } from "vitest";
import { calculateDataCentreDesign } from "./model";
import { peerStatistic, selectPeers, type RzregPerformanceRecord } from "./benchmark";

describe("data-centre design", () => {
  it("converts IT load and PUE into auditable annual energy", () => {
    const result = calculateDataCentreDesign({
      itLoadMw: 10,
      pue: 1.4,
      loadFactorPct: 90,
      renewableEnergyFactorPct: 80,
      energyReuseFactorPct: 20,
      wueLitresPerKwhIt: 0.5,
      wasteHeatTemperatureC: 30,
    });
    expect(result.facilityPeakMw).toBe(14);
    expect(result.annualItEnergyGwh).toBe(78.84);
    expect(result.annualFacilityEnergyGwh).toBe(110.38);
    expect(result.annualReusableHeatGwh).toBe(22.08);
  });

  it("fails safely by constraining invalid factors", () => {
    const result = calculateDataCentreDesign({
      itLoadMw: 5,
      pue: 26.2,
      loadFactorPct: 100,
      renewableEnergyFactorPct: 120,
      energyReuseFactorPct: -1,
      wueLitresPerKwhIt: 0,
      wasteHeatTemperatureC: null,
    });
    expect(result.facilityPeakMw).toBe(15);
    expect(result.warnings).toHaveLength(3);
  });
});

describe("RZReg peer benchmark", () => {
  const record = (
    id: string,
    it: number,
    pue: number,
    warnings: string[] = [],
  ): RzregPerformanceRecord => ({
    id,
    name: id,
    operator: "Test",
    postcode: "10115",
    size_class: "",
    surface_area_m2: null,
    metrics: {
      connected_it_kw: it,
      connected_non_redundant_kw: it,
      annual_electricity_kwh: 1,
      renewable_energy_factor_pct: 100,
      pue,
      energy_reuse_factor_pct: 0,
      cooling_efficiency_ratio: 4,
      wue_l_per_kwh_it: 0,
      waste_heat_released_kwh: 1,
      waste_heat_reused_kwh: 0,
    },
    validation_warnings: warnings,
  });
  it("excludes quarantined values", () => {
    const result = peerStatistic(
      [
        record("a", 1000, 1.2),
        record("b", 2000, 1.4),
        record("c", 3000, 26.2, ["pue:outside_validation_range"]),
      ],
      "pue",
    );
    expect(result).toEqual({ count: 2, p25: 1.25, median: 1.3, p75: 1.35 });
  });
  it("uses a load band only when the cohort remains defensible", () => {
    const records = Array.from({ length: 12 }, (_, index) =>
      record(String(index), 8_000 + index * 100, 1.3),
    );
    expect(selectPeers(records, 10)).toHaveLength(12);
  });
});
