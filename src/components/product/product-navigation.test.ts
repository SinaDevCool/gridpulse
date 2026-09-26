import { describe, expect, it } from "vitest";
import {
  primaryWorkspaceDestinationIds,
  isWorkspaceDestinationActive,
  workspaceLinks,
  workspaceDestinationsForMode,
} from "./product-navigation";

describe("workspace outcome navigation", () => {
  it("exposes 3 independent primary workspace destinations", () => {
    expect(primaryWorkspaceDestinationIds).toEqual(["sites", "finder", "operations"]);
    expect(workspaceDestinationsForMode("finder").map((item) => item.to)).toEqual([
      "/portfolio",
      "/power-finder",
      "/operations",
    ]);
    expect(workspaceDestinationsForMode("full").map((item) => item.to)).toEqual([
      "/portfolio",
      "/power-finder",
      "/operations",
    ]);
    expect(new Set(workspaceLinks.map((item) => item.to)).size).toBe(workspaceLinks.length);
    expect(workspaceDestinationsForMode("finder").map((item) => item.group)).toEqual([
      "planning",
      "planning",
      "operations",
    ]);
  });

  it("keeps detail pages in their owning workflow", () => {
    expect(isWorkspaceDestinationActive("/portfolio/site-1", "/portfolio")).toBe(true);
    expect(isWorkspaceDestinationActive("/activation/site-1", "/activation")).toBe(true);
    expect(isWorkspaceDestinationActive("/operations/site-1", "/operations")).toBe(true);
    expect(isWorkspaceDestinationActive("/evidence-review", "/evidence")).toBe(true);
    expect(isWorkspaceDestinationActive("/reports", "/portfolio")).toBe(false);
  });
});
