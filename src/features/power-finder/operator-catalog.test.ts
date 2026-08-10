import { describe, expect, it } from "vitest";
import { mergeOperatorBounds } from "./operator-map-navigation";

describe("operator map extents", () => {
  it("merges aliases into one complete geographic extent", () => {
    expect(mergeOperatorBounds([8, 50, 10, 52], [9, 49, 13, 51])).toEqual([8, 49, 13, 52]);
  });

  it("preserves a known extent when an alias has no mapped geometry", () => {
    expect(mergeOperatorBounds([8, 50, 10, 52], null)).toEqual([8, 50, 10, 52]);
    expect(mergeOperatorBounds(null, [8, 50, 10, 52])).toEqual([8, 50, 10, 52]);
  });
});
