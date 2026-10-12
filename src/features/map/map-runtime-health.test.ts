import { describe, expect, it } from "vitest";
import { deriveMapUsability, updateMapRuntimeHealth } from "./map-runtime-health";

describe("map runtime health", () => {
  it("keeps a map usable when only background geography fails", () => {
    expect(deriveMapUsability({ basemap: "unavailable", grid: "ready", viewport: "ready" })).toBe(
      "degraded",
    );
  });

  it("does not call a map unavailable while an accepted viewport remains ready", () => {
    expect(deriveMapUsability({ grid: "unavailable", viewport: "ready" })).toBe("degraded");
  });

  it("updates one source without erasing the others", () => {
    expect(updateMapRuntimeHealth({ grid: "ready" }, "registry", "degraded")).toEqual({
      grid: "ready",
      registry: "degraded",
    });
  });
});
