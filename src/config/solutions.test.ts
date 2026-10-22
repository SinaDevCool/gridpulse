import { describe, expect, it } from "vitest";
import {
  parseEnabledSolutions,
  solutionForPath,
  solutionOwner,
  solutionRouteAvailable,
  solutions,
} from "./solutions";

describe("independent business solutions", () => {
  it("defaults to both without tying availability to legacy product modes", () => {
    expect(parseEnabledSolutions(undefined)).toEqual(["planning", "operations"]);
    expect(parseEnabledSolutions("operations")).toEqual(["operations"]);
    expect(parseEnabledSolutions("planning,operations,planning")).toEqual([
      "planning",
      "operations",
    ]);
    for (const value of ["", "finder", "planning,unknown", "planning,"])
      expect(() => parseEnabledSolutions(value)).toThrow();
    expect(new Set(solutions.map((item) => item.id)).size).toBe(2);
  });
  it("owns UI, API and introduction paths while leaving platform resources neutral", () => {
    for (const path of [
      "/operations",
      "/operations/facility/",
      "/api/operations/assess",
      "/solutions/facility-operations",
    ])
      expect(solutionOwner(path)).toBe("operations");
    for (const path of [
      "/portfolio/site",
      "/power-finder",
      "/api/power-finder/tile/1/2/3",
      "/api/properties/enrich",
      "/solutions/site-selection",
    ])
      expect(solutionOwner(path)).toBe("planning");
    for (const path of ["/", "/assets/file.js", "/operations-other", "/api/operations-other"])
      expect(solutionOwner(path)).toBeNull();
    expect(solutionForPath("/operations").to).toBe("/operations");
    expect(solutionForPath("/portfolio").to).toBe("/power-finder");
  });
  it("independently disables both UI and backend routes without disabling shared resources", () => {
    for (const available of [["planning"], ["operations"], ["planning", "operations"]] as const) {
      for (const path of [
        "/operations",
        "/api/operations/runs",
        "/api/operations/workspace",
        "/api/operations/ingest",
      ])
        expect(solutionRouteAvailable(path, available)).toBe(
          available.some((id) => id === "operations"),
        );
      for (const path of ["/power-finder", "/portfolio/123", "/api/power-finder/study"])
        expect(solutionRouteAvailable(path, available)).toBe(
          available.some((id) => id === "planning"),
        );
      expect(solutionRouteAvailable("/assets/app.js", available)).toBe(true);
    }
  });
});
