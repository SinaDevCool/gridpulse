import { describe, expect, it } from "vitest";
import { fallbackCoverage, resolveGovernedCoverage } from "./coverage";

describe("Germany-wide Power Finder coverage", () => {
  it("derives layer availability only from matching governed releases", () => {
    const regions = resolveGovernedCoverage({
      coverage_status: "partial",
      releases: [
        {
          source_id: "osm",
          release_id: "release-1",
          scope: "Berlin",
          activated_at: "2026-11-01",
          layer_counts: { nodes: 25 },
        },
      ],
    });
    expect(regions.find((region) => region.regionCode === "DE-BE")).toMatchObject({
      status: "accepted",
      topology: true,
      registeredAssets: false,
    });
    expect(regions.find((region) => region.regionCode === "DE-BY")?.status).toBe("unavailable");
    expect(
      resolveGovernedCoverage({ coverage_status: "unavailable", releases: [] }).every(
        (region) => !region.topology,
      ),
    ).toBe(true);
  });
  it("declares national coverage plus every federal state without claiming headroom", () => {
    const stateCodes = [
      "DE-BW",
      "DE-BY",
      "DE-BE",
      "DE-BB",
      "DE-HB",
      "DE-HH",
      "DE-HE",
      "DE-MV",
      "DE-NI",
      "DE-NW",
      "DE-RP",
      "DE-SL",
      "DE-SN",
      "DE-ST",
      "DE-SH",
      "DE-TH",
    ];

    expect(fallbackCoverage.find((item) => item.regionCode === "DE")?.status).toBe("unavailable");
    expect(
      stateCodes.every((code) => fallbackCoverage.some((item) => item.regionCode === code)),
    ).toBe(true);
    expect(fallbackCoverage).toHaveLength(17);
    expect(fallbackCoverage.every((item) => !item.topology && !item.registeredAssets)).toBe(true);
    expect(fallbackCoverage.every((item) => !item.publishedDemandCapacity)).toBe(true);
  });
});
