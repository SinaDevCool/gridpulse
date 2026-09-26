import { describe, expect, it } from "vitest";
import { parsePrivateGraphWorkspace } from "./private-graph-workspace";

describe("private graph workspace contract", () => {
  it("fails closed and never accepts a capacity claim", () => {
    const result = parsePrivateGraphWorkspace({ state: "physics_verified", capacity_claim: true });
    expect(result.capacity_claim).toBe(false);
  });

  it("parses bounded pathways and ignores malformed rows", () => {
    const result = parsePrivateGraphWorkspace({
      state: "model_accepted",
      pathways: {
        pathways: [
          {
            rank: 1,
            target_bus: "B2",
            bus_ids: ["B1", "B2"],
            asset_ids: ["L1"],
            total_graph_cost: 4,
          },
          { target_bus: "bad" },
        ],
      },
    });
    expect(result.pathways?.pathways).toHaveLength(1);
  });
});
