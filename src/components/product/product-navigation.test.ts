import { describe, expect, it } from "vitest";
import {
  activeWorkspaceStageIds,
  isWorkspaceDestinationActive,
  workspaceLinks,
  workspaceLinksForMode,
} from "./product-navigation";

describe("workspace outcome navigation", () => {
  it("exposes only the focused three-stage workflow", () => {
    expect(activeWorkspaceStageIds).toEqual(["sites", "finder", "constraints"]);
    expect(workspaceLinksForMode("finder").map((item) => item.to)).toEqual([
      "/portfolio",
      "/power-finder",
      "/constraint-explorer",
    ]);
    expect(workspaceLinksForMode("full").map((item) => item.to)).toEqual([
      "/portfolio",
      "/power-finder",
      "/constraint-explorer",
    ]);
    expect(new Set(workspaceLinks.map((item) => item.to)).size).toBe(workspaceLinks.length);
  });

  it("keeps detail pages in their owning workflow", () => {
    expect(isWorkspaceDestinationActive("/portfolio/site-1", "/portfolio")).toBe(true);
    expect(isWorkspaceDestinationActive("/activation/site-1", "/activation")).toBe(true);
    expect(isWorkspaceDestinationActive("/operations/site-1", "/operations")).toBe(true);
    expect(isWorkspaceDestinationActive("/evidence-review", "/evidence")).toBe(true);
    expect(isWorkspaceDestinationActive("/reports", "/portfolio")).toBe(false);
  });
});
