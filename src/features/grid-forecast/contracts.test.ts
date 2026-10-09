import { describe, expect, it } from "vitest";
import { gridStressForecastSchema } from "./contracts";

describe("grid-stress public contract", () => {
  it("accepts explicit unavailable state", () => {
    expect(gridStressForecastSchema.parse({ schemaVersion: "gridpulse-grid-stress-public-v1", status: "unavailable", regionCode: "DE", confidence: "unavailable", drivers: [], caveats: [], sourceFreshness: {}, decisionBoundary: "not capacity" }).status).toBe("unavailable");
  });

  it("rejects impossible probabilities", () => {
    expect(() => gridStressForecastSchema.parse({ schemaVersion: "gridpulse-grid-stress-public-v1", status: "available", regionCode: "DE", confidence: "high", highStressProbability: 2, drivers: [], caveats: [], sourceFreshness: {}, decisionBoundary: "not capacity" })).toThrow();
  });
});
