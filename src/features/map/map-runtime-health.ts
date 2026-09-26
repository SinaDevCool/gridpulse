export type MapRuntimeState = "idle" | "loading" | "ready" | "degraded" | "unavailable";
export type MapRuntimeSource = "basemap" | "grid" | "registry" | "viewport" | "dataCentres";
export type MapRuntimeHealth = Partial<Record<MapRuntimeSource, MapRuntimeState>>;

export type MapUsability = "loading" | "ready" | "degraded" | "unavailable";

export function updateMapRuntimeHealth(
  current: MapRuntimeHealth,
  source: MapRuntimeSource,
  state: MapRuntimeState,
): MapRuntimeHealth {
  return { ...current, [source]: state };
}

export function deriveMapUsability(health: MapRuntimeHealth): MapUsability {
  if (health.grid === "ready" || health.viewport === "ready") {
    return Object.values(health).some((state) => state === "degraded" || state === "unavailable")
      ? "degraded"
      : "ready";
  }
  if (health.grid === "loading" || health.viewport === "loading") return "loading";
  if (health.grid === "unavailable" && health.viewport === "unavailable") return "unavailable";
  return "loading";
}
