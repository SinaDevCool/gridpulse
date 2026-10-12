import { type MapRuntimeSourceStatus } from "@/features/map/map-source-registry";
import { type C1StudyPayload } from "@/features/power-finder/c1-study";
import { type RankedCandidateResult } from "@/features/power-finder/candidate-intelligence";
import { fallbackCoverage,type PowerFinderCoverage } from "@/features/power-finder/coverage";
import { type PowerFinderDataMode } from "@/features/power-finder/data-source";
import { type PowerFinderCollection } from "@/features/power-finder/fixture-data";
import { type GridOperatorOption } from "@/features/power-finder/operator-catalog";
import { type OperatorEvidenceResult } from "@/features/power-finder/operator-evidence";
import { useState } from "react";
import type { FinderSearch } from "./search-contract";

export function useFinderDataState(search: FinderSearch) {
  const [collection, setCollection] = useState<PowerFinderCollection | null>(null);

  const [error, setError] = useState("");

  const [dataMode, setDataMode] = useState<PowerFinderDataMode | null>(null);

  const [runtimeSourceStatus, setRuntimeSourceStatus] = useState<MapRuntimeSourceStatus>({});

  const [operatorEvidence, setOperatorEvidence] = useState<OperatorEvidenceResult | null>(null);

  const [operatorEvidenceState, setOperatorEvidenceState] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");

  const [c1Study, setC1Study] = useState<C1StudyPayload | null>(null);

  const [ranking, setRanking] = useState<RankedCandidateResult | null>(null);

  const [rankingCollection, setRankingCollection] = useState<PowerFinderCollection | null>(null);

  const [rankingState, setRankingState] = useState<"loading" | "ready" | "error">("loading");

  const [coverage, setCoverage] = useState<PowerFinderCoverage[]>(fallbackCoverage);

  const [operatorCatalog, setOperatorCatalog] = useState<GridOperatorOption[]>([]);

  const [operatorCatalogState, setOperatorCatalogState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  return {
    collection,
    setCollection,
    error,
    setError,
    dataMode,
    setDataMode,
    runtimeSourceStatus,
    setRuntimeSourceStatus,
    operatorEvidence,
    setOperatorEvidence,
    operatorEvidenceState,
    setOperatorEvidenceState,
    c1Study,
    setC1Study,
    ranking,
    setRanking,
    rankingCollection,
    setRankingCollection,
    rankingState,
    setRankingState,
    coverage,
    setCoverage,
    operatorCatalog,
    setOperatorCatalog,
    operatorCatalogState,
    setOperatorCatalogState,
  };
}
