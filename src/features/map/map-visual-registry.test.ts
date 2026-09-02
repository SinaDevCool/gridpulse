import { describe, expect, it } from "vitest";
import { GENERATION_TECHNOLOGY_CLASSES, generationTechnologyLabel } from "./map-visual-registry";

describe("canonical map visual registry", () => {
  it("owns one style for every generation class", () => {
    expect(new Set(GENERATION_TECHNOLOGY_CLASSES.map((item) => item.id)).size).toBe(
      GENERATION_TECHNOLOGY_CLASSES.length,
    );
    expect(GENERATION_TECHNOLOGY_CLASSES.every((item) => item.color && item.label)).toBe(true);
  });

  it("fails unknown technology into an explicit nonclaim category", () => {
    expect(generationTechnologyLabel("future-fuel")).toBe("Other / unknown");
    expect(generationTechnologyLabel(null)).toBe("Other / unknown");
  });
});
