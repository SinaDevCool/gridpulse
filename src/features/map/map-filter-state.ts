import type { GenerationTechnologyId } from "@/features/map/map-visual-registry";
import type { GridVoltageClassId } from "@/features/power-finder/voltage-style";

export type MapPreset = "connection" | "infrastructure" | "generation";
export type MapIsolation =
  | { dimension: "voltage"; value: GridVoltageClassId }
  | { dimension: "technology"; value: GenerationTechnologyId | "storage" }
  | null;

export type SharedMapFilterState = {
  preset: MapPreset;
  isolation: MapIsolation;
  minimumGenerationMw: number;
  maximumGenerationMw: number | null;
  minimumStorageMw: number;
  maximumStorageMw: number | null;
  scaleMarkersByCapacity: boolean;
};

export const initialSharedMapFilterState: SharedMapFilterState = {
  preset: "connection",
  isolation: null,
  minimumGenerationMw: 0,
  maximumGenerationMw: null,
  minimumStorageMw: 0,
  maximumStorageMw: null,
  scaleMarkersByCapacity: true,
};

export type SharedMapFilterAction =
  | { type: "set_preset"; preset: MapPreset }
  | { type: "isolate"; isolation: Exclude<MapIsolation, null> }
  | { type: "clear_isolation" }
  | { type: "set_generation_range"; minimum: number; maximum: number | null }
  | { type: "set_storage_range"; minimum: number; maximum: number | null }
  | { type: "set_capacity_scaling"; enabled: boolean }
  | { type: "reset"; preset?: MapPreset };

function validRange(minimum: number, maximum: number | null) {
  const safeMinimum = Math.max(0, Number.isFinite(minimum) ? minimum : 0);
  const safeMaximum = maximum === null || !Number.isFinite(maximum) ? null : Math.max(0, maximum);
  return {
    minimum: safeMaximum === null ? safeMinimum : Math.min(safeMinimum, safeMaximum),
    maximum: safeMaximum,
  };
}

export function sharedMapFilterReducer(
  state: SharedMapFilterState,
  action: SharedMapFilterAction,
): SharedMapFilterState {
  switch (action.type) {
    case "set_preset":
      return { ...state, preset: action.preset, isolation: null };
    case "isolate":
      return {
        ...state,
        isolation:
          state.isolation?.dimension === action.isolation.dimension &&
          state.isolation.value === action.isolation.value
            ? null
            : action.isolation,
      };
    case "clear_isolation":
      return { ...state, isolation: null };
    case "set_generation_range": {
      const range = validRange(action.minimum, action.maximum);
      return { ...state, minimumGenerationMw: range.minimum, maximumGenerationMw: range.maximum };
    }
    case "set_storage_range": {
      const range = validRange(action.minimum, action.maximum);
      return { ...state, minimumStorageMw: range.minimum, maximumStorageMw: range.maximum };
    }
    case "set_capacity_scaling":
      return { ...state, scaleMarkersByCapacity: action.enabled };
    case "reset":
      return { ...initialSharedMapFilterState, preset: action.preset ?? state.preset };
  }
}
