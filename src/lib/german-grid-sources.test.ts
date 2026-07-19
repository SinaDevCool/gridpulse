import { describe, expect, it } from "vitest";
import { germanGridEvidenceGaps, germanGridSources } from "./german-grid-sources";

describe("German official-source registry", () => {
  it("keeps every claim attached to an official HTTPS source and an explicit limitation", () => {
    expect(germanGridSources.length).toBeGreaterThanOrEqual(5);
    for (const source of germanGridSources) {
      expect(source.url.startsWith("https://")).toBe(true);
      expect(source.establishes.length).toBeGreaterThan(0);
      expect(source.doesNotEstablish.length).toBeGreaterThan(0);
    }
  });

  it("preserves the central public-evidence gaps", () => {
    expect(germanGridEvidenceGaps.some((gap) => gap.includes("node-by-node"))).toBe(true);
    expect(germanGridEvidenceGaps.some((gap) => gap.includes("connection-time"))).toBe(true);
  });
});
