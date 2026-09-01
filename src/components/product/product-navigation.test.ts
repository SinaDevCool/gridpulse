import { describe, expect, it } from "vitest";
import { isWorkspaceDestinationActive, workspaceLinks } from "./product-navigation";

describe("workspace outcome navigation", () => {
  it("exposes each canonical workflow exactly once", () => {
    expect(workspaceLinks.map((item) => item.to)).toEqual([
      "/portfolio",
      "/power-finder",
      "/data-centre-planner",
      "/activation",
      "/operations",
      "/evidence",
      "/reports",
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
