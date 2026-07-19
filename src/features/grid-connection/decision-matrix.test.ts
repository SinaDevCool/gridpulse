import { describe, expect, it } from "vitest";
import { buildConnectionOptions } from "./connection-options";
import { buildDecisionMatrix } from "./decision-matrix";

const base = {
  requestedImportMw: 80,
  minimumViableImportMw: 50,
  reducedFirmImportMw: 40,
  conditionalImportMw: 30,
  operatorSupported: false,
  profile: null,
  dispatch: {
    minimumCriticalLoadMw: 50,
    shiftableLoadMw: 10,
    batteryPowerMw: 10,
    batteryEnergyMwh: 20,
    batteryRoundTripEfficiency: 0.9,
    batteryMinimumSoc: 0.1,
    initialBatterySoc: 1,
    energyValueEurMwh: 200,
    batteryDegradationEurMwh: 20,
  },
};

describe("decision matrix", () => {
  it("keeps hypotheses behind explicit evidence gates", () => {
    const rows = buildDecisionMatrix(buildConnectionOptions(base));
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.evidenceReadiness < 100)).toBe(true);
    expect(rows.every((row) => row.nextAction.length > 20)).toBe(true);
  });
});
