import type { LayerSpecification, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

export type BasemapMode = "dark" | "light";
export type BasemapStatus = "loading" | "available" | "fallback";

export type BasemapLayerIds = Record<BasemapMode, string[]>;

export type LoadedBasemapStyle = {
  style: StyleSpecification;
  layerIds: BasemapLayerIds;
  status: Exclude<BasemapStatus, "loading">;
};

export const OPEN_FREE_MAP_STYLE_URLS: Record<BasemapMode, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

const EMPTY_LAYER_IDS = (): BasemapLayerIds => ({ dark: [], light: [] });

function prefixedLayers(
  style: StyleSpecification,
  mode: BasemapMode,
  visibleMode: BasemapMode,
): LayerSpecification[] {
  return style.layers.map((layer) => ({
    ...layer,
    id: `openfreemap-${mode}-${layer.id}`,
    layout: {
      ...(layer.layout ?? {}),
      visibility: mode === visibleMode ? "visible" : "none",
    },
  })) as LayerSpecification[];
}

export function combineOpenFreeMapStyles(
  dark: StyleSpecification,
  light: StyleSpecification,
  visibleMode: BasemapMode,
): LoadedBasemapStyle {
  const darkLayers = prefixedLayers(dark, "dark", visibleMode);
  const lightLayers = prefixedLayers(light, "light", visibleMode);

  return {
    status: "available",
    layerIds: {
      dark: darkLayers.map((layer) => layer.id),
      light: lightLayers.map((layer) => layer.id),
    },
    style: {
      version: 8,
      name: "GridPulse OpenFreeMap basemap",
      sources: { ...dark.sources, ...light.sources },
      sprite: dark.sprite ?? light.sprite,
      glyphs: dark.glyphs ?? light.glyphs,
      layers: [...darkLayers, ...lightLayers],
    },
  };
}

export function createFallbackBasemapStyle(visibleMode: BasemapMode): LoadedBasemapStyle {
  const layerIds: BasemapLayerIds = {
    dark: ["gridpulse-fallback-dark"],
    light: ["gridpulse-fallback-light"],
  };
  const layers: LayerSpecification[] = [
    {
      id: layerIds.dark[0],
      type: "background",
      layout: { visibility: visibleMode === "dark" ? "visible" : "none" },
      paint: { "background-color": "#071521" },
    },
    {
      id: layerIds.light[0],
      type: "background",
      layout: { visibility: visibleMode === "light" ? "visible" : "none" },
      paint: { "background-color": "#eef3f5" },
    },
  ];

  return {
    status: "fallback",
    layerIds,
    style: { version: 8, name: "GridPulse fallback basemap", sources: {}, layers },
  };
}

async function fetchStyle(url: string, signal: AbortSignal): Promise<StyleSpecification> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Basemap style returned ${response.status}`);
  return (await response.json()) as StyleSpecification;
}

export async function loadBasemapStyle(
  visibleMode: BasemapMode,
  options: { timeoutMs?: number; fetchStyle?: typeof fetchStyle } = {},
): Promise<LoadedBasemapStyle> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  const loader = options.fetchStyle ?? fetchStyle;

  try {
    const [dark, light] = await Promise.all([
      loader(OPEN_FREE_MAP_STYLE_URLS.dark, controller.signal),
      loader(OPEN_FREE_MAP_STYLE_URLS.light, controller.signal),
    ]);
    return combineOpenFreeMapStyles(dark, light, visibleMode);
  } catch {
    return createFallbackBasemapStyle(visibleMode);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function applyBasemapVisibility(
  map: MapLibreMap,
  mode: BasemapMode,
  layerIds: BasemapLayerIds = EMPTY_LAYER_IDS(),
) {
  for (const candidateMode of ["dark", "light"] as const) {
    const visibility = candidateMode === mode ? "visible" : "none";
    for (const layerId of layerIds[candidateMode]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
    }
  }
}
