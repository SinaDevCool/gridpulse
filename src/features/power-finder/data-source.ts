import { supabase } from "@/integrations/supabase/client";
import {
  parsePowerFinderCollection,
  type PowerFinderCollection,
} from "@/features/power-finder/fixture-data";
import { isFinderMvp } from "@/config/product-mode";
import { finderReleaseToken, FinderReleaseChangedError } from "@/config/finder-release";
import { scopeFallback } from "./fallback-scope";
import { toPublicPowerFinderCollection } from "./public-data";

export type PowerFinderBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const FALLBACK_URL = "/power-finder/brandenburg-osm.json";

export type PowerFinderDataMode = "database" | "public_database" | "published_artifact";

async function loadFallback(
  bounds: PowerFinderBounds,
  signal?: AbortSignal,
): Promise<PowerFinderCollection> {
  const response = await fetch(FALLBACK_URL, { signal });
  if (!response.ok) throw new Error(`Power Finder fallback returned ${response.status}.`);
  const scoped = scopeFallback(
    toPublicPowerFinderCollection(parsePowerFinderCollection(await response.json())),
    bounds,
  );
  if (!scoped.features.length) throw new Error("No accepted static fallback covers this viewport.");
  return scoped;
}

async function loadPublicViewport(
  bounds: PowerFinderBounds,
  signal?: AbortSignal,
  layers: { generation: boolean; storage: boolean } = { generation: true, storage: true },
) {
  const query = new URLSearchParams({
    release: finderReleaseToken,
    west: String(bounds.west),
    south: String(bounds.south),
    east: String(bounds.east),
    north: String(bounds.north),
    generation: String(layers.generation),
    storage: String(layers.storage),
  });
  if (!layers.generation && !layers.storage) query.set("ranking", "true");
  const response = await fetch(`/api/power-finder/viewport?${query}`, { signal });
  if (response.status === 409) throw new FinderReleaseChangedError();
  if (!response.ok) throw new Error(`Public Finder API returned ${response.status}.`);
  return toPublicPowerFinderCollection(parsePowerFinderCollection(await response.json()));
}

export async function loadPowerFinderViewport(
  bounds: PowerFinderBounds,
  signal?: AbortSignal,
  options: { fallbackAllowed?: boolean; includeRegistryAssets?: boolean } = {},
): Promise<{ collection: PowerFinderCollection; mode: PowerFinderDataMode }> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (isFinderMvp()) {
    try {
      const collection = await loadPublicViewport(bounds, signal, {
        generation: options.includeRegistryAssets !== false,
        storage: options.includeRegistryAssets !== false,
      });
      if (
        options.fallbackAllowed === false &&
        collection.metadata.coverage_status === "accepted_static_fallback"
      )
        throw new Error("Live regional data unavailable.");
      return {
        collection,
        mode:
          collection.metadata.coverage_status === "accepted_static_fallback"
            ? "published_artifact"
            : "public_database",
      };
    } catch (error) {
      if (error instanceof FinderReleaseChangedError) throw error;
      if (signal?.aborted) throw error;
      if (options.fallbackAllowed === false) throw error;
      return { collection: await loadFallback(bounds, signal), mode: "published_artifact" };
    }
  }
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
    return {
      collection: toPublicPowerFinderCollection(parsePowerFinderCollection(data)),
      mode: "database",
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (options.fallbackAllowed === false) {
      throw new Error(
        "No accepted national viewport is available. Select Brandenburg or try the live database again.",
      );
    }
    return { collection: await loadFallback(bounds, signal), mode: "published_artifact" };
  }
}
