import { type FinderProject } from "@/features/power-finder/finder-project";
import {
  validateFinderNumber,
  type FinderNumericField,
} from "@/features/power-finder/project-validation";
import { type ChangeEvent } from "react";

export function useFinderEditing({
  setProject,
  setDiscoveryResults,
  setSelectedDiscoveryId,
  setDiscoveryState,
  dispatchMapFilter,
  mapFilters,
  updateSearch,
  setMapNavigationTarget,
  setNumericDrafts,
  setFieldErrors,
}: Pick<
  import("./controller-contract").FinderControllerContract,
  | "setProject"
  | "setDiscoveryResults"
  | "setSelectedDiscoveryId"
  | "setDiscoveryState"
  | "dispatchMapFilter"
  | "mapFilters"
  | "updateSearch"
  | "setMapNavigationTarget"
  | "setNumericDrafts"
  | "setFieldErrors"
>) {
  const updateProject = (patch: Partial<FinderProject>) => {
    setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  };

  const updateScenarioNumber =
    (
      field:
        | "ultimateImportMw"
        | "minimumFirmMw"
        | "flexibleLoadMw"
        | "targetEnergisationYear"
        | "annualConsumptionGwh"
        | "maxInterruptionHours"
        | "annualInterruptionLimit"
        | "batteryRoundTripEfficiencyPct"
        | "batteryReservePct"
        | "onsiteGenerationMw",
      minimum: number,
      maximum: number,
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value))
        updateProject({ [field]: Math.min(maximum, Math.max(minimum, value)) });
    };

  const invalidateDiscoveryResults = () => {
    setDiscoveryResults([]);
    setSelectedDiscoveryId(null);
    setDiscoveryState("idle");
  };

  const minimumGenerationMw = mapFilters.minimumGenerationMw;

  const minimumStorageMw = mapFilters.minimumStorageMw;

  const setMinimumGenerationMw = (minimum: number) => {
    dispatchMapFilter({
      type: "set_generation_range",
      minimum,
      maximum: mapFilters.maximumGenerationMw,
    });
    void updateSearch({ generationMinMw: minimum || undefined });
  };

  const setMaximumGenerationMw = (maximum: number | null) => {
    dispatchMapFilter({
      type: "set_generation_range",
      minimum: mapFilters.minimumGenerationMw,
      maximum,
    });
    void updateSearch({ generationMaxMw: maximum ?? undefined });
  };

  const setMinimumStorageMw = (minimum: number) => {
    dispatchMapFilter({
      type: "set_storage_range",
      minimum,
      maximum: mapFilters.maximumStorageMw,
    });
    void updateSearch({ storageMinMw: minimum || undefined });
  };

  const setMaximumStorageMw = (maximum: number | null) => {
    dispatchMapFilter({
      type: "set_storage_range",
      minimum: mapFilters.minimumStorageMw,
      maximum,
    });
    void updateSearch({ storageMaxMw: maximum ?? undefined });
  };

  const navigateMapToPoint = (center: [number, number]) =>
    setMapNavigationTarget({ requestId: Date.now(), kind: "point", center, zoom: 11 });

  const commitNumber = (
    field: FinderNumericField,
    raw: string,
    commit: (value: number | null) => void,
    optional = false,
  ) => {
    setNumericDrafts((current) => ({ ...current, [field]: raw }));
    if (optional && !raw.trim()) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
      commit(null);
      return;
    }
    const result = validateFinderNumber(field, raw);
    setFieldErrors((current) => ({ ...current, [field]: result.error ?? undefined }));
    if (!result.error) commit(result.value);
  };
  return {
    updateProject,
    updateScenarioNumber,
    invalidateDiscoveryResults,
    minimumGenerationMw,
    minimumStorageMw,
    setMinimumGenerationMw,
    setMaximumGenerationMw,
    setMinimumStorageMw,
    setMaximumStorageMw,
    navigateMapToPoint,
    commitNumber,
  };
}
