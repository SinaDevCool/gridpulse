import { describe, expect, it } from "vitest";
import { buildConnectionOptions, rankConnectionOptions } from "./connection-options";

const profile = [60, 60, 80, 80].map((importMw, index) => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, index * 15)).toISOString(),
  importMw,
  exportMw: 0,
}));

const base = {
  requestedImportMw: 80,
  minimumViableImportMw: 50,
  reducedFirmImportMw: 40,
  conditionalImportMw: 30,
  operatorSupported: false,
  profile,
  dispatch: {
    minimumCriticalLoadMw: 50,
    shiftableLoadMw: 10,
    batteryPowerMw: 10,
    batteryEnergyMwh: 10,
    batteryRoundTripEfficiency: 1,
    batteryMinimumSoc: 0,
    initialBatterySoc: 1,
    energyValueEurMwh: 200,
    batteryDegradationEurMwh: 20,
  },
};

describe("connection option set", () => {
  it("creates the six standard German connection hypotheses", () => {
    expect(buildConnectionOptions(base).map((option) => option.kind)).toEqual([
      "requested_firm",
      "reduced_firm",
      "staged",
      "static_flexible",
      "dynamic_flexible",
      "storage_supported",
    ]);
  });

  it("flags options below the declared minimum viable import", () => {
    const options = buildConnectionOptions(base);
    expect(options.find((option) => option.kind === "reduced_firm")?.operationalStatus).toBe(
      "fails_minimum_viable_capacity",
    );
  });

  it("does not turn a model result into operator-supported evidence", () => {
    expect(
      buildConnectionOptions(base).every(
        (option) => option.evidenceStatus === "customer_hypothesis",
      ),
    ).toBe(true);
  });

  it("ranks viable options ahead of minimum-capacity failures", () => {
    const ranked = rankConnectionOptions(buildConnectionOptions(base));
    expect(ranked.at(-1)?.operationalStatus).toBe("fails_minimum_viable_capacity");
  });
});
