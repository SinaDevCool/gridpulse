import { supabase } from "@/integrations/supabase/client";
import {
  parsePowerFinderCollection,
  type PowerFinderCollection,
} from "@/features/power-finder/fixture-data";

export type PowerFinderBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const FALLBACK_URL = "/power-finder/brandenburg-osm.json";

async function loadFallback(signal?: AbortSignal): Promise<PowerFinderCollection> {
  const response = await fetch(FALLBACK_URL, { signal });
  if (!response.ok) throw new Error(`Power Finder fallback returned ${response.status}.`);
  return parsePowerFinderCollection(await response.json());
}

export async function loadPowerFinderViewport(
  bounds: PowerFinderBounds,
  signal?: AbortSignal,
  options: { fallbackAllowed?: boolean } = {},
): Promise<{ collection: PowerFinderCollection; mode: "database" | "published_artifact" }> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  try {
    const { data, error } = await supabase.rpc("power_finder_viewport", {
      west: bounds.west,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
      max_features: 2500,
    });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (error) throw error;
    return { collection: parsePowerFinderCollection(data), mode: "database" };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (options.fallbackAllowed === false) {
      throw new Error(
        "No accepted national viewport is available. Select Brandenburg or try the live database again.",
      );
    }
    return { collection: await loadFallback(signal), mode: "published_artifact" };
  }
}
