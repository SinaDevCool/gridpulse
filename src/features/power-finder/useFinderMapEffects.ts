import { mapIsolationSearchPatch } from "@/features/map/map-url-state";
import { useEffect } from "react";
import type { useFinderController } from "./use-finder-controller";
type Context = Pick<
  ReturnType<typeof useFinderController>,
  | "enabled"
  | "updateSearch"
  | "dispatchMapFilter"
  | "basemapStatus"
  | "setBasemapStatus"
  | "mapRetryKey"
  | "isolatedTechnology"
>;
export function useFinderMapEffects(context: Context) {
  const {
    enabled,
    updateSearch,
    dispatchMapFilter,
    basemapStatus,
    setBasemapStatus,
    mapRetryKey,
    isolatedTechnology,
  } = context;
  useEffect(() => {
    if (basemapStatus !== "loading") return;
    const timeout = window.setTimeout(() => setBasemapStatus("fallback"), 3_500);
    return () => window.clearTimeout(timeout);
  }, [basemapStatus, mapRetryKey, setBasemapStatus]);
  useEffect(() => {
    if (!isolatedTechnology) return;
    const isolatedLayerDisabled =
      (isolatedTechnology === "storage" && !enabled.storage_asset) ||
      (isolatedTechnology !== "storage" && !enabled.generation_asset);
    if (!isolatedLayerDisabled) return;
    dispatchMapFilter({ type: "clear_isolation" });
    void updateSearch(mapIsolationSearchPatch(null));
    // URL isolation must never hide an enabled layer after its own layer was disabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled.generation_asset, enabled.storage_asset, isolatedTechnology]);
}
