import { describe, expect, it } from "vitest";
import { mapIsolationFromSearch, mapIsolationSearchPatch } from "./map-url-state";

describe("map URL state", () => {
  it.each([
    { dimension: "voltage" as const, value: "ehv" as const },
    { dimension: "technology" as const, value: "wind" as const },
    { dimension: "technology" as const, value: "storage" as const },
  ])("round trips $dimension:$value", (isolation) => {
    expect(mapIsolationFromSearch(mapIsolationSearchPatch(isolation))).toEqual(isolation);
  });

  it("prefers voltage when malformed external state contains both dimensions", () => {
    expect(mapIsolationFromSearch({ isolateVoltage: "220kv", isolateTechnology: "solar" })).toEqual(
      { dimension: "voltage", value: "220kv" },
    );
  });
});
