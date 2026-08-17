import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type RzregArtifact = {
  metadata: {
    record_count: number;
    facility_address_count: number;
    postcode_area_count: number;
    warning: string;
  };
  features: Array<{
    properties: {
      location_precision: "facility_address" | "postcode_area";
      address: string | null;
      warning: string | null;
    };
  }>;
};

const artifact = JSON.parse(
  readFileSync(resolve("public/power-finder/rzreg-data-centres.json"), "utf8"),
) as RzregArtifact;

describe("RZReg public map artifact", () => {
  it("keeps all registered records and reconciles precision counts", () => {
    expect(artifact.features).toHaveLength(319);
    expect(artifact.metadata.record_count).toBe(319);
    expect(artifact.metadata.facility_address_count + artifact.metadata.postcode_area_count).toBe(
      319,
    );
  });

  it("never presents postcode coordinates as facility addresses", () => {
    for (const feature of artifact.features) {
      if (feature.properties.location_precision === "postcode_area") {
        expect(feature.properties.address).toBeNull();
        expect(feature.properties.warning).toMatch(/postcode/i);
      }
    }
  });

  it("retains the capacity disclaimer", () => {
    expect(artifact.metadata.warning).toMatch(/do not establish grid capacity/i);
  });
});
