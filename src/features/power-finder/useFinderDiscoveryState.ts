import {
  type DiscoveryLocation,
  type DiscoveryStrategy,
} from "@/features/power-finder/location-discovery";
import { useState } from "react";
import type { FinderSearch } from "./search-contract";

export function useFinderDiscoveryState(search: FinderSearch) {
  const [finderWorkflow, setFinderWorkflow] = useState<"screen" | "discover">(
    search.workflow ?? "screen",
  );

  const [discoveryStrategy, setDiscoveryStrategy] = useState<DiscoveryStrategy>(
    search.discoveryStrategy ?? "balanced",
  );

  const [discoveryResultCount, setDiscoveryResultCount] = useState<10 | 20>(
    search.discoveryCount === 20 ? 20 : 10,
  );

  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryLocation[]>([]);

  const [selectedDiscoveryId, setSelectedDiscoveryId] = useState<string | null>(null);

  const [discoveryState, setDiscoveryState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  return {
    finderWorkflow,
    setFinderWorkflow,
    discoveryStrategy,
    setDiscoveryStrategy,
    discoveryResultCount,
    setDiscoveryResultCount,
    discoveryResults,
    setDiscoveryResults,
    selectedDiscoveryId,
    setSelectedDiscoveryId,
    discoveryState,
    setDiscoveryState,
  };
}
