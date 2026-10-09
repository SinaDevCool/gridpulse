import { describe, expect, it } from "vitest";
import { topologyConclusions, topologySafetyNotice } from "./topology-intelligence";

describe("private topology conclusions", () => {
  it("labels synthetic topology and never calls it capacity", () => {
    const rows = topologyConclusions({ pathwayCount: 3, completePathwayCount: 1,
      sharedUpstreamAssetCount: 2, physicsStudyCompleted: false,
      validationClass: "synthetic_demonstration" });
    expect(rows[0]).toContain("Synthetic");
    expect(rows).toContain("Physics study pending");
    expect(topologySafetyNotice).toContain("do not establish available grid capacity");
  });
});
