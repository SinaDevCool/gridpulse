import { describe, expect, it } from "vitest";
import { validateFinderNumber } from "./project-validation";

describe("Finder project validation", () => {
  it("accepts valid coordinates and rejects unsafe route values", () => {
    expect(validateFinderNumber("latitude", "52.31")).toEqual({ value: 52.31, error: null });
    expect(validateFinderNumber("latitude", "60").error).toMatch(/47.*56/);
    expect(validateFinderNumber("importMw", "2000").value).toBeNull();
  });
});
