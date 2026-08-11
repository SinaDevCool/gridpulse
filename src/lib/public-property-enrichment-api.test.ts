import { describe, expect, it } from "vitest";
import { parseEnrichmentRequest } from "./public-property-enrichment-api";

describe("public property enrichment request", () => {
  it("accepts a bounded anonymous batch", () => {
    expect(
      parseEnrichmentRequest({
        properties: [{ propertyId: "p1", latitude: 52.5, longitude: 13.4, boundary: null }],
        sources: ["bkg_admin"],
      }).properties,
    ).toHaveLength(1);
  });
  it("rejects unsupported sources and non-German coordinates", () => {
    expect(() =>
      parseEnrichmentRequest({ properties: [{ propertyId: "p1", latitude: 1, longitude: 1 }] }),
    ).toThrow(/coordinates/);
    expect(() =>
      parseEnrichmentRequest({
        properties: [{ propertyId: "p1", latitude: 52.5, longitude: 13.4 }],
        sources: ["unknown"],
      }),
    ).toThrow(/unsupported/);
  });
});
