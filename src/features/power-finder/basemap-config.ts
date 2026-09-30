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

export function activateDataOnlyBasemap(
  map: MapLibreMap,
  visibleMode: BasemapMode,
  layerIds: BasemapLayerIds,
) {
  for (const layerId of [...layerIds.dark, ...layerIds.light]) {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
  }
  const fallbackId = `gridpulse-runtime-fallback-${visibleMode}`;
  const otherFallbackId = `gridpulse-runtime-fallback-${visibleMode === "dark" ? "light" : "dark"}`;
  if (map.getLayer(otherFallbackId)) map.setLayoutProperty(otherFallbackId, "visibility", "none");
  if (map.getLayer(fallbackId)) {
    map.setLayoutProperty(fallbackId, "visibility", "visible");
    return;
  }
  const firstLayerId = map.getStyle().layers?.[0]?.id;
  map.addLayer(
    {
      id: fallbackId,
      type: "background",
      paint: { "background-color": visibleMode === "dark" ? "#071521" : "#eef3f5" },
    },
    firstLayerId,
  );
}

async function fetchStyle(url: string, signal: AbortSignal): Promise<StyleSpecification> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        if (response.status < 500 || attempt === 1) {
          throw new Error(`Basemap style returned ${response.status}`);
        }
      } else {
        return (await response.json()) as StyleSpecification;
      }
    } catch (error) {
      if (signal.aborted || attempt === 1) throw error;
      lastError = error;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = globalThis.setTimeout(resolve, 150 + Math.round(Math.random() * 100));
      signal.addEventListener(
        "abort",
        () => {
          globalThis.clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }
  throw lastError ?? new Error("Basemap style is unavailable");
}

export async function loadBasemapStyle(
  visibleMode: BasemapMode,
  options: { timeoutMs?: number; fetchStyle?: typeof fetchStyle } = {},
): Promise<LoadedBasemapStyle> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 3_000);
  const loader = options.fetchStyle ?? fetchStyle;

  try {
    const [darkResult, lightResult] = await Promise.allSettled([
      loader(OPEN_FREE_MAP_STYLE_URLS.dark, controller.signal),
      loader(OPEN_FREE_MAP_STYLE_URLS.light, controller.signal),
    ]);
    const activeResult = visibleMode === "dark" ? darkResult : lightResult;
    if (activeResult.status === "rejected") return createFallbackBasemapStyle(visibleMode);
    const inactiveResult = visibleMode === "dark" ? lightResult : darkResult;
    if (inactiveResult.status === "rejected") {
      const style = activeResult.value;
      const layers = prefixedLayers(style, visibleMode, visibleMode);
      return {
        status: "available",
        layerIds: {
          dark: visibleMode === "dark" ? layers.map((layer) => layer.id) : [],
          light: visibleMode === "light" ? layers.map((layer) => layer.id) : [],
        },
        style: { ...style, layers },
      };
    }
    if (darkResult.status === "fulfilled" && lightResult.status === "fulfilled") {
      return combineOpenFreeMapStyles(darkResult.value, lightResult.value, visibleMode);
    }
    return createFallbackBasemapStyle(visibleMode);
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
