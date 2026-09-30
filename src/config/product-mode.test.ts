import { describe, expect, it } from "vitest";
import {
  capabilitiesForMode,
  isRouteEnabled,
  isRouteEnabledForMode,
  productCapabilities,
  productMode,
  retiredWorkspaceDestination,
} from "./product-mode";

describe("Finder MVP route boundary", () => {
  it("documents the public Finder allowlist", async () => {
    expect(productMode).toBe("finder");
    expect(productCapabilities.authentication).toBe(false);
    expect(isRouteEnabled("/")).toBe(true);
    expect(isRouteEnabled("/power-finder")).toBe(true);
    expect(isRouteEnabled("/constraint-explorer")).toBe(false);
    expect(isRouteEnabled("/activation")).toBe(false);
    expect(isRouteEnabled("/operations")).toBe(true);
    expect(isRouteEnabled("/activation/private-id")).toBe(false);
    expect(isRouteEnabled("/operations/private-id")).toBe(false);
    expect(isRouteEnabled("/data-sources")).toBe(true);
    expect(isRouteEnabled("/synthetic-network-study")).toBe(true);
    expect(isRouteEnabled("/api/synthetic-network-study")).toBe(false);
    expect(isRouteEnabled("/auth")).toBe(false);
    expect(isRouteEnabled("/portfolio")).toBe(true);
    expect(isRouteEnabled("/workspaces")).toBe(true);
    expect(isRouteEnabled("/portfolio/00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isRouteEnabled("/data-centre-planner")).toBe(false);
    expect(isRouteEnabled("/reports")).toBe(false);
    expect(isRouteEnabled("/evidence")).toBe(false);
    expect(isRouteEnabled("/capacity-dossiers/00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isRouteEnabled("/assessments/new")).toBe(false);
  });

  it("maps dormant workspace URLs into the focused product", () => {
    expect(retiredWorkspaceDestination("/data-centre-planner")).toBe("/power-finder");
    expect(retiredWorkspaceDestination("/evidence-review")).toBe("/power-finder");
    expect(retiredWorkspaceDestination("/reports")).toBe("/portfolio");
    expect(retiredWorkspaceDestination("/activation/private-id")).toBe("/power-finder");
    expect(retiredWorkspaceDestination("/operations/private-id/")).toBe("/operations");
    expect(retiredWorkspaceDestination("/constraint-explorer")).toBe("/operations");
  });

  it("reactivates the retained workspace in connect and full modes", () => {
    expect(isRouteEnabledForMode("/portfolio", "connect")).toBe(true);
    expect(isRouteEnabledForMode("/reports", "full")).toBe(false);
    expect(isRouteEnabledForMode("/assessments/new", "full")).toBe(true);
    expect(capabilitiesForMode("connect").authentication).toBe(false);
    expect(capabilitiesForMode("connect").operate).toBe(false);
    expect(capabilitiesForMode("full").operate).toBe(true);
  });
});
