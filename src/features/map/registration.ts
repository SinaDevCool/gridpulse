import type { Map as MapLibreMap } from "maplibre-gl";

/** Re-registering an overlay after a style reload must not duplicate its identity. */
export function addMapLayer(map: MapLibreMap, ...args: Parameters<MapLibreMap["addLayer"]>) {
  if (map.getLayer(args[0].id)) return map;
  return map.addLayer(...args);
}
export function addMapSource(map: MapLibreMap, ...args: Parameters<MapLibreMap["addSource"]>) {
  if (map.getSource(args[0])) return map;
  return map.addSource(...args);
}
