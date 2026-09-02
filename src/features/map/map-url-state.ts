import type { MapIsolation } from "./map-filter-state";
import type { GenerationTechnologyId } from "./map-visual-registry";
import type { GridVoltageClassId } from "@/features/power-finder/voltage-style";

export type MapIsolationSearch = {
  isolateVoltage?: GridVoltageClassId;
  isolateTechnology?: GenerationTechnologyId | "storage";
};

export function mapIsolationFromSearch(search: MapIsolationSearch): MapIsolation {
  if (search.isolateVoltage) return { dimension: "voltage", value: search.isolateVoltage };
  if (search.isolateTechnology) return { dimension: "technology", value: search.isolateTechnology };
  return null;
}

export function mapIsolationSearchPatch(isolation: MapIsolation): MapIsolationSearch {
  return {
    isolateVoltage: isolation?.dimension === "voltage" ? isolation.value : undefined,
    isolateTechnology: isolation?.dimension === "technology" ? isolation.value : undefined,
  };
}
