import { describe, expect, it } from "vitest";
import { assessOperations, parseOperationsCsv } from "./analytics";

describe("real-data operations analytics", () => {
  it("parses the documented CSV contract", () => {
    const rows = parseOperationsCsv("timestamp,grid_import_mw,gpu_power_mw\n2026-01-01T00:00:00Z,42,20\n2026-01-01T00:15:00Z,43,21");
    expect(rows).toHaveLength(2);
    expect(rows[1].gpuPowerMw).toBe(21);
  });

  it("calculates facility headroom against the declared limit", () => {
    const measurements = Array.from({ length: 24 }, (_, index) => ({
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index * 15)).toISOString(),
      gridImportMw: index === 23 ? 48 : 42,
      gpuPowerMw: null, itLoadMw: null, coolingPowerMw: null,
      bessPowerMw: null, bessSocPercent: 80, shiftableLoadMw: 2,
    }));
    const result = assessOperations({
      facilityName: "Real facility", contractedLimitMw: 50,
      limitEvidence: "customer_declared", measurements,
      bess: { powerMw: 4, energyMwh: 8, minimumReservePercent: 20, roundTripEfficiency: 0.9 },
    });
    expect(result.currentHeadroomMw).toBe(2);
    expect(result.sampleCount).toBe(24);
  });

  it("rejects files without required columns", () => {
    expect(() => parseOperationsCsv("time,power\nnow,2")).toThrow(/Required columns/);
  });
});
