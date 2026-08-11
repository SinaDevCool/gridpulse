import { describe, expect, it } from "vitest";
import {
  capabilitiesForMode,
  isRouteEnabled,
  isRouteEnabledForMode,
  productCapabilities,
  productMode,
} from "./product-mode";

describe("Finder MVP route boundary", () => {
  it("documents the public Finder allowlist", async () => {
    expect(productMode).toBe("finder");
    expect(productCapabilities.authentication).toBe(false);
    expect(isRouteEnabled("/")).toBe(true);
    expect(isRouteEnabled("/power-finder")).toBe(true);
    expect(isRouteEnabled("/activation")).toBe(true);
    expect(isRouteEnabled("/operations")).toBe(true);
    expect(isRouteEnabled("/data-sources")).toBe(true);
    expect(isRouteEnabled("/synthetic-network-study")).toBe(true);
    expect(isRouteEnabled("/api/synthetic-network-study")).toBe(false);
    expect(isRouteEnabled("/auth")).toBe(false);
    expect(isRouteEnabled("/portfolio")).toBe(false);
    expect(isRouteEnabled("/assessments/new")).toBe(false);
  });

  it("reactivates the retained workspace in connect and full modes", () => {
    expect(isRouteEnabledForMode("/portfolio", "connect")).toBe(true);
    expect(isRouteEnabledForMode("/assessments/new", "full")).toBe(true);
    expect(capabilitiesForMode("connect").authentication).toBe(true);
    expect(capabilitiesForMode("connect").operate).toBe(false);
    expect(capabilitiesForMode("full").operate).toBe(true);
  });
});
