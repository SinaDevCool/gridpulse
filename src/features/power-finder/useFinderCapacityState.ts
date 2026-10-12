import {
type BerlinSyntheticCapacityArtifact,
type CalculatedCapacityViewport,
type CapacityMetric,
} from "@/features/power-finder/calculated-capacity";
import { type FinderProject } from "@/features/power-finder/finder-project";
import { useState } from "react";
import type { FinderSearch } from "./search-contract";

export function useFinderCapacityState(search: FinderSearch, project: FinderProject) {
  const [mapMode, setMapMode] = useState<"voltage" | "evidence" | "capacity">(
    search.mapMode ?? "voltage",
  );

  const [capacityMetric, setCapacityMetric] = useState<CapacityMetric>(
    search.capacityMetric ?? "firm_import_mw",
  );

  const [requiredCapacityMw, setRequiredCapacityMw] = useState(
    search.requiredMw ?? project.importMw,
  );

  const [capacitySource, setCapacitySource] = useState<"private" | "berlin_synthetic">(
    search.capacitySource === "private" && search.workspaceId ? "private" : "berlin_synthetic",
  );

  const [capacityViewport, setCapacityViewport] = useState<CalculatedCapacityViewport | null>(null);

  const [berlinCapacity, setBerlinCapacity] = useState<BerlinSyntheticCapacityArtifact | null>(
    null,
  );

  const [capacityState, setCapacityState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  return {
    mapMode,
    setMapMode,
    capacityMetric,
    setCapacityMetric,
    requiredCapacityMw,
    setRequiredCapacityMw,
    capacitySource,
    setCapacitySource,
    capacityViewport,
    setCapacityViewport,
    berlinCapacity,
    setBerlinCapacity,
    capacityState,
    setCapacityState,
  };
}
