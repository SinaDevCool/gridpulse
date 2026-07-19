import { describe, expect, it } from "vitest";
import { capacityTruth, latestCapacityByNode, parseJsonObject } from "./node-intelligence";
import type { CapacitySnapshot } from "@/lib/assessment-model";

const snapshot = (version: number, status = "draft") =>
  ({ id: `${version}`, node_id: "node-1", version, status }) as CapacitySnapshot;

describe("node intelligence truth controls", () => {
  it("selects the latest version independently of input order", () => {
    expect(latestCapacityByNode([snapshot(3), snapshot(1), snapshot(2)]).get("node-1")?.version).toBe(3);
  });
  it("does not describe reviewed internal evidence as operator confirmed", () => {
    expect(capacityTruth(snapshot(1, "reviewed"))).toEqual({
      label: "Reviewed planning evidence",
      level: "reviewed",
    });
  });
  it("accepts only object-shaped study results", () => {
    expect(parseJsonObject('{"headroom_mw":12}')).toEqual({ headroom_mw: 12 });
    expect(() => parseJsonObject("[1,2]")).toThrow(/JSON object/);
  });
});
