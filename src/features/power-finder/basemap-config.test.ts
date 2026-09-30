import { describe, expect, it, vi } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import {
  OPEN_FREE_MAP_STYLE_URLS,
  applyBasemapVisibility,
  activateDataOnlyBasemap,
  combineOpenFreeMapStyles,
  createFallbackBasemapStyle,
  loadBasemapStyle,
} from "./basemap-config";

const style = (id: string, colour: string): StyleSpecification => ({
  version: 8,
  sources: {
    openmaptiles: { type: "vector", tiles: [`https://example.test/${id}/{z}/{x}/{y}.pbf`] },
  },
  sprite: "https://example.test/sprite",
  glyphs: "https://example.test/fonts/{fontstack}/{range}.pbf",
  layers: [{ id, type: "background", paint: { "background-color": colour } }],
});

describe("Power Finder basemap configuration", () => {
  it("uses keyless OpenFreeMap styles", () => {
    expect(OPEN_FREE_MAP_STYLE_URLS).toEqual({
      dark: "https://tiles.openfreemap.org/styles/dark",
      light: "https://tiles.openfreemap.org/styles/positron",
    });
    expect(Object.values(OPEN_FREE_MAP_STYLE_URLS).join(" ")).not.toMatch(/key=|carto/i);
  });

  it("combines light and dark styles into independently switchable groups", () => {
    const result = combineOpenFreeMapStyles(
      style("dark-base", "#000"),
      style("light-base", "#fff"),
      "dark",
    );
    expect(result.status).toBe("available");
    expect(result.layerIds).toEqual({
      dark: ["openfreemap-dark-dark-base"],
      light: ["openfreemap-light-light-base"],
    });
    expect(result.style.layers?.map((layer) => layer.layout?.visibility)).toEqual([
      "visible",
      "none",
    ]);
  });

  it("returns a local light/dark fallback when provider loading fails", async () => {
    const result = await loadBasemapStyle("light", {
      fetchStyle: async () => {
        throw new Error("offline");
      },
    });
    expect(result.status).toBe("fallback");
    expect(result.style.sources).toEqual({});
    expect(result.style.layers?.map((layer) => layer.layout?.visibility)).toEqual([
      "none",
      "visible",
    ]);
  });

  it("changes only basemap-layer visibility", () => {
    const map = {
      getLayer: vi.fn(() => ({})),
      setLayoutProperty: vi.fn(),
    };
    applyBasemapVisibility(map as never, "light", { dark: ["dark-a"], light: ["light-a"] });
    expect(map.setLayoutProperty).toHaveBeenCalledWith("dark-a", "visibility", "none");
    expect(map.setLayoutProperty).toHaveBeenCalledWith("light-a", "visibility", "visible");
  });

  it("builds a valid local fallback without third-party sources", () => {
    const result = createFallbackBasemapStyle("dark");
    expect(result.style.version).toBe(8);
    expect(result.style.sources).toEqual({});
    expect(result.layerIds.dark).toHaveLength(1);
    expect(result.layerIds.light).toHaveLength(1);
  });

  it("turns a loaded map into a real data-only fallback", () => {
    const map = {
      getLayer: vi.fn((id: string) => (id === "dark-a" ? {} : undefined)),
      setLayoutProperty: vi.fn(),
      getStyle: vi.fn(() => ({ layers: [{ id: "dark-a" }] })),
      addLayer: vi.fn(),
    };
    activateDataOnlyBasemap(map as never, "dark", { dark: ["dark-a"], light: ["light-a"] });
    expect(map.setLayoutProperty).toHaveBeenCalledWith("dark-a", "visibility", "none");
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "gridpulse-runtime-fallback-dark", type: "background" }),
      "dark-a",
    );
  });

  it("keeps the active style when only the inactive theme fails", async () => {
    const result = await loadBasemapStyle("dark", {
      fetchStyle: async (url) => {
        if (url.includes("positron")) throw new Error("light unavailable");
        return style("dark-base", "#000");
      },
    });
    expect(result.status).toBe("available");
    expect(result.layerIds.dark).toEqual(["openfreemap-dark-dark-base"]);
    expect(result.layerIds.light).toEqual([]);
  });
});
