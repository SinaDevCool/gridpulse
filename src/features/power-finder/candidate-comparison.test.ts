import { describe, expect, it } from "vitest";
import {
  addComparisonCandidate,
  parseComparison,
  removeComparisonCandidate,
} from "./candidate-comparison";

describe("Finder candidate comparison", () => {
  it("adds up to five unique candidates without silently replacing one", () => {
    let ids: string[] = [];
    for (const id of ["a", "b", "c", "d", "e"]) ids = addComparisonCandidate(ids, id).ids;
    expect(ids).toEqual(["a", "b", "c", "d", "e"]);
    expect(addComparisonCandidate(ids, "f")).toEqual({ ids, limitReached: true });
  });

  it("deduplicates parsed URLs and removes a selected candidate", () => {
    expect(parseComparison("a,b,a,c")).toEqual(["a", "b", "c"]);
    expect(removeComparisonCandidate(["a", "b"], "a")).toEqual(["b"]);
  });
});
