import { describe, expect, it } from "vitest";
import {
  defaultFinderProject,
  finderProjectTypes,
  projectOperatorQuestions,
} from "./finder-project";

describe("Finder project profiles", () => {
  it("supports all public screening project types", () => {
    expect(Object.keys(finderProjectTypes)).toEqual([
      "data_centre",
      "industrial_load",
      "battery_storage",
      "co_location",
      "electrolyser",
      "charging_hub",
    ]);
  });

  it("keeps battery import and export questions separate", () => {
    const questions = projectOperatorQuestions({
      ...defaultFinderProject,
      type: "battery_storage",
      importMw: 50,
      exportMw: 50,
    }).join(" ");
    expect(questions).toContain("import capacity");
    expect(questions).toContain("export capacity");
  });
});
