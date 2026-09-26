import { describe, expect, it } from "vitest";
import { initialSharedMapFilterState, sharedMapFilterReducer } from "./map-filter-state";

describe("shared map filter state", () => {
  it("toggles a scoped isolation without destroying range selections", () => {
    const ranged = sharedMapFilterReducer(initialSharedMapFilterState, {
      type: "set_generation_range",
      minimum: 50,
      maximum: 500,
    });
    const isolated = sharedMapFilterReducer(ranged, {
      type: "isolate",
      isolation: { dimension: "voltage", value: "220kv" },
    });
    expect(isolated.isolation).toEqual({ dimension: "voltage", value: "220kv" });
    expect(isolated.minimumGenerationMw).toBe(50);
    expect(
      sharedMapFilterReducer(isolated, {
        type: "isolate",
        isolation: { dimension: "voltage", value: "220kv" },
      }).isolation,
    ).toBeNull();
  });

  it("normalises inverted ranges and resets within the selected preset", () => {
    const ranged = sharedMapFilterReducer(initialSharedMapFilterState, {
      type: "set_storage_range",
      minimum: 100,
      maximum: 10,
    });
    expect(ranged.minimumStorageMw).toBe(10);
    expect(ranged.maximumStorageMw).toBe(10);
    expect(sharedMapFilterReducer(ranged, { type: "reset", preset: "generation" })).toEqual({
      ...initialSharedMapFilterState,
      preset: "generation",
    });
  });
});
