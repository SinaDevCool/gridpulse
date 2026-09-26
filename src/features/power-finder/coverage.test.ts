import { describe, expect, it } from "vitest";
import { fallbackCoverage } from "./coverage";

describe("Germany-wide Power Finder coverage", () => {
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

    expect(fallbackCoverage.find((item) => item.regionCode === "DE")?.status).toBe("accepted");
    expect(
      stateCodes.every((code) => fallbackCoverage.some((item) => item.regionCode === code)),
    ).toBe(true);
    expect(fallbackCoverage).toHaveLength(17);
    expect(fallbackCoverage.every((item) => item.topology && item.registeredAssets)).toBe(true);
    expect(fallbackCoverage.every((item) => !item.publishedDemandCapacity)).toBe(true);
  });
});
