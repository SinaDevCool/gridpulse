import { loadPowerFinderViewport } from "@/features/power-finder/data-source";
import {
  type PowerFinderCollection,
  type PowerFinderFeature,
} from "@/features/power-finder/fixture-data";
import {
  discoverLocations,
  type DiscoveryStrategy,
} from "@/features/power-finder/location-discovery";
import { loadRegionalDiscoverySamples } from "@/features/power-finder/regional-discovery-sampling";

import { useEffect, useRef } from "react";
import type { FinderControllerContract } from "./controller-contract";

type DiscoveryModel = Pick<
  FinderControllerContract,
  | "activeCoverage"
  | "project"
  | "discoveryResultCount"
  | "discoveryStrategy"
  | "generationGroup"
  | "minimumGenerationMw"
  | "minimumStorageMw"
  | "setDiscoveryState"
  | "setInteractionNotice"
  | "setDiscoveryResults"
  | "setSelectedDiscoveryId"
  | "setMapNavigationTarget"
>;
/** One async owner, bounded by input identity and component lifetime. */
export function useRegionalDiscovery(model: DiscoveryModel) {
  const {
    activeCoverage,
    project,
    discoveryResultCount,
    discoveryStrategy,
    generationGroup,
    minimumGenerationMw,
    minimumStorageMw,
    setDiscoveryState,
    setInteractionNotice,
    setDiscoveryResults,
    setSelectedDiscoveryId,
    setMapNavigationTarget,
  } = model;
  const request = useRef<{ revision: number; controller: AbortController | null }>({
    revision: 0,
    controller: null,
  });
  const identity = JSON.stringify([
    activeCoverage.regionCode,
    activeCoverage.bounds,
    project,
    discoveryResultCount,
    discoveryStrategy,
    generationGroup,
    minimumGenerationMw,
    minimumStorageMw,
  ]);
  const latestIdentity = useRef(identity);
  latestIdentity.current = identity;
  useEffect(
    () => () => {
      request.current.revision++;
      request.current.controller?.abort();
    },
    [identity],
  );
  return async function runDiscovery() {
    request.current.controller?.abort();
    const controller = new AbortController();
    const revision = ++request.current.revision;
    request.current.controller = controller;
    const isCurrent = () =>
      request.current.revision === revision &&
      latestIdentity.current === identity &&
      !controller.signal.aborted;
    setDiscoveryState("loading");
    setInteractionNotice("Sampling accepted mapped context across the region…");
    try {
      const [west, south, east, north] = activeCoverage.bounds;
      const columns = 4;
      const rows = 4;
      const longitudeStep = (east - west) / columns;
      const latitudeStep = (north - south) / rows;
      const sampleBounds = Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        return {
          west: west + column * longitudeStep,
          south: south + row * latitudeStep,
          east: west + (column + 1) * longitudeStep,
          north: south + (row + 1) * latitudeStep,
        };
      });
      const { samples, fullContextCount, gridOnlyCount, unavailableCount } =
        await loadRegionalDiscoverySamples(
          sampleBounds,
          (bounds, options) => loadPowerFinderViewport(bounds, controller.signal, options),
          controller.signal,
        );
      if (samples.length === 0) {
        throw new Error("No regional samples were available.");
      }
      const byId = new Map<string, PowerFinderFeature>();
      for (const sample of samples) {
        for (const feature of sample.collection.features) byId.set(feature.id, feature);
      }
      const regionalCollection: PowerFinderCollection = {
        ...samples[0].collection,
        features: [...byId.values()],
        metadata: {
          ...samples[0].collection.metadata,
          title: `${activeCoverage.regionName} discovery sample`,
          record_count: byId.size,
          geographic_scope: activeCoverage.bounds,
        },
      };
      const results = discoverLocations(regionalCollection, {
        regionCode: activeCoverage.regionCode,
        requiredMw: project.importMw,
        preferredVoltageKv: project.preferredVoltageKv,
        maxNodeDistanceKm: project.maxDistanceKm,
        resultCount: discoveryResultCount,
        strategy: discoveryStrategy,
        generationGroup,
        minimumGenerationMw,
        minimumStorageMw,
      });
      if (!isCurrent()) return;
      setDiscoveryResults(results);
      setSelectedDiscoveryId(results[0]?.id ?? null);
      setMapNavigationTarget({
        requestId: Date.now(),
        kind: "bounds",
        bounds: activeCoverage.bounds,
        maxZoom: activeCoverage.zoom,
      });
      setDiscoveryState("ready");
      setInteractionNotice(
        results.length
          ? `${results.length} geographically distinct investigation locations found${
              gridOnlyCount > 0 || unavailableCount > 0
                ? ` from ${samples.length} of ${sampleBounds.length} available regional samples (${fullContextCount} with energy context, ${gridOnlyCount} grid-only)`
                : " after regional sampling and local refinement"
            }. ${
              unavailableCount > 0
                ? `${unavailableCount} unavailable area${unavailableCount === 1 ? " remains" : "s remain"} unassessed.`
                : gridOnlyCount > 0
                  ? "Energy-ecosystem context was unavailable for some areas; their scores use grid context only."
                  : ""
            }`
          : "No investigation locations met the current mapped-data criteria. Try a wider node distance.",
      );
    } catch {
      if (!isCurrent()) return;
      setDiscoveryState("error");
      setInteractionNotice("Regional data sampling was incomplete. Please try again.");
    }
  };
}
