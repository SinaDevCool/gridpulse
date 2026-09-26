import { gridStressForecastSchema, type GridStressForecast } from "./contracts";

export async function loadCurrentGridStressForecast(region = "DE", signal?: AbortSignal): Promise<GridStressForecast> {
  const response = await fetch(`/api/forecasts/grid-stress/current?region=${encodeURIComponent(region)}`, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Grid outlook request failed (${response.status}).`);
  return gridStressForecastSchema.parse(await response.json());
}
