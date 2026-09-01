import { describe, expect, it } from "vitest";
import { constraintExposureSchema } from "./contracts";
import { renderLocationAsPoint } from "../map/map-layer-registry";

describe("constraint exposure boundary", () => {
  it("rejects missing canonical fingerprints", () =>
    expect(
      constraintExposureSchema.safeParse({ schemaVersion: "gridpulse-constraint-exposure-v1" })
        .success,
    ).toBe(false));
  it("does not render imprecise locations as exact points", () => {
    expect(renderLocationAsPoint("postcode")).toBe(false);
    expect(renderLocationAsPoint("exact_published")).toBe(true);
  });
});
