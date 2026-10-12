import {
  loadBerlinSyntheticCapacity,
  loadCalculatedCapacityViewport,
} from "@/features/power-finder/calculated-capacity";
import { useEffect } from "react";
import type { FinderControllerContract } from "./controller-contract";
type Context = Pick<
  FinderControllerContract,
  | "search"
  | "collection"
  | "project"
  | "mapMode"
  | "setMapMode"
  | "capacityMetric"
  | "setCapacityMetric"
  | "setRequiredCapacityMw"
  | "capacitySource"
  | "setCapacitySource"
  | "setCapacityViewport"
  | "setBerlinCapacity"
  | "setCapacityState"
>;
export function useFinderCapacityEffects(context: Context) {
  const {
    search,
    collection,
    project,
    mapMode,
    setMapMode,
    capacityMetric,
    setCapacityMetric,
    setRequiredCapacityMw,
    capacitySource,
    setCapacitySource,
    setCapacityViewport,
    setBerlinCapacity,
    setCapacityState,
  } = context;
  useEffect(() => {
    const privateCapacitySelected =
      search.capacitySource === "private" && Boolean(search.workspaceId);
    const requestedMetric = search.capacityMetric ?? "firm_import_mw";
    const safeMetric =
      privateCapacitySelected ||
      requestedMetric === "n0_import_mw" ||
      requestedMetric === "firm_import_mw"
        ? requestedMetric
        : "firm_import_mw";
    setMapMode(search.mapMode ?? "voltage");
    setCapacitySource(privateCapacitySelected ? "private" : "berlin_synthetic");
    setCapacityMetric(safeMetric);
    setRequiredCapacityMw(search.requiredMw ?? project.importMw);
  }, [
    search.capacityMetric,
    search.capacitySource,
    search.mapMode,
    search.requiredMw,
    search.workspaceId,
    project.importMw,
    setMapMode,
    setCapacitySource,
    setCapacityMetric,
    setRequiredCapacityMw,
  ]);
  useEffect(() => {
    if (mapMode !== "capacity") {
      return;
    }
    setCapacityState("loading");
    if (capacitySource === "berlin_synthetic") {
      void loadBerlinSyntheticCapacity()
        .then((result) => {
          setBerlinCapacity(result);
          setCapacityState("ready");
        })
        .catch(() => {
          setBerlinCapacity(null);
          setCapacityState("error");
        });
      return;
    }
    void loadCalculatedCapacityViewport({
      workspaceId: search.workspaceId,
      metric: capacityMetric,
      mappedNodeCount:
        collection?.features.filter((feature) => feature.properties.kind === "node").length ?? 0,
    })
      .then((result) => {
        setCapacityViewport(result);
        setCapacityState("ready");
      })
      .catch(() => {
        setCapacityViewport(null);
        setCapacityState("error");
      });
  }, [
    capacityMetric,
    capacitySource,
    collection,
    mapMode,
    search.workspaceId,
    setBerlinCapacity,
    setCapacityState,
    setCapacityViewport,
  ]);
}
