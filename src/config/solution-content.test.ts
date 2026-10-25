import { describe, expect, it } from "vitest";
import { landingContentFor, solutionContent } from "./solution-content";
import { solutions } from "./solutions";

describe("public service presentation", () => {
  it("keeps both services independent and uses authoritative destinations", () => {
    const page = landingContentFor(["planning", "operations"]);
    expect(page.solutions).toEqual(solutions);
    expect(page.title).toContain("Site Selection & Facility Operations");
    expect(page.headline).toBe("Choose the site. Plan the operation.");
    expect(solutionContent.operations.badge).toContain("Synthetic");
    expect(solutionContent.operations.boundary).toContain("no equipment commands");
  });
  for (const id of ["planning", "operations"] as const) {
    it(`does not advertise a disabled service in ${id}-only builds`, () => {
      const page = landingContentFor([id]);
      expect(page.solutions).toEqual([solutions.find((solution) => solution.id === id)]);
      expect(page.title).toBe(`${page.solutions[0].label} | GridPulse`);
      expect(page.description).toBe(solutionContent[id].summary);
      expect(page.headline).toBe(solutionContent[id].headline);
    });
  }
});
