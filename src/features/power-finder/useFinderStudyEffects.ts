import { productCapabilities } from "@/config/product-mode";
import { loadC1Study } from "@/features/power-finder/c1-study";
import {
applyPreferredVoltageContext,
rankCandidatesForLocation,
} from "@/features/power-finder/candidate-intelligence";
import { loadOperatorEvidence } from "@/features/power-finder/operator-evidence";
import { useEffect } from "react";
import type { useFinderController } from "./use-finder-controller";
type Context = Pick<
  ReturnType<typeof useFinderController>,
  | "project"
  | "selected"
  | "setSelected"
  | "setSelectedOpportunitySnapshot"
  | "dataMode"
  | "requiredImportMw"
  | "maxDistanceKm"
  | "setSaveStatus"
  | "setShortlistId"
  | "setOperatorEvidence"
  | "setOperatorEvidenceState"
  | "setC1Study"
  | "setRanking"
  | "rankingCollection"
  | "setRankingState"
  | "candidates"
>;
export function useFinderStudyEffects(context: Context) {
  const {
    project,
    selected,
    setSelected,
    setSelectedOpportunitySnapshot,
    dataMode,
    requiredImportMw,
    maxDistanceKm,
    setSaveStatus,
    setShortlistId,
    setOperatorEvidence,
    setOperatorEvidenceState,
    setC1Study,
    setRanking,
    rankingCollection,
    setRankingState,
    candidates,
  } = context;
  useEffect(() => {
    if (!productCapabilities.workspace) return;
    setSaveStatus("idle");
    setShortlistId(null);
  }, [selected?.id, setSaveStatus, setShortlistId]);
  useEffect(() => {
    if (!productCapabilities.workspace) return;
    setOperatorEvidence(null);
    if (!selected || selected.properties.kind !== "node" || dataMode !== "database") {
      setOperatorEvidenceState("idle");
      return;
    }
    const controller = new AbortController();
    setOperatorEvidenceState("loading");
    void loadOperatorEvidence(selected.id, controller.signal)
      .then((result) => {
        setOperatorEvidence(result);
        setOperatorEvidenceState("ready");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("Operator evidence could not be loaded.", reason);
          setOperatorEvidenceState("unavailable");
        }
      });
    return () => controller.abort();
  }, [dataMode, selected, setOperatorEvidence, setOperatorEvidenceState]);
  useEffect(() => {
    setC1Study(null);
    if (!selected || selected.properties.kind !== "node") {
      return;
    }
    const controller = new AbortController();
    void loadC1Study(String(selected.id), controller.signal)
      .then((result) => {
        setC1Study(result);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selected, setC1Study]);
  useEffect(() => {
    const sourceCollection = rankingCollection;
    if (!sourceCollection || !dataMode) return;
    if (project.latitude == null || project.longitude == null) {
      setRanking(null);
      setRankingState("ready");
      setSelectedOpportunitySnapshot(null);
      setSelected(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setRankingState("loading");
    const resultPromise = Promise.resolve(
      rankCandidatesForLocation(
        sourceCollection,
        project.longitude,
        project.latitude,
        requiredImportMw,
        maxDistanceKm,
        project.name,
      ),
    );
    void resultPromise
      .then((result) => ({
        ...result,
        candidates: applyPreferredVoltageContext(
          result.candidates,
          project.preferredVoltageKv,
          project.type,
        ),
      }))
      .then((result) => {
        if (!active) return;
        setRanking(result);
        setRankingState("ready");
      })
      .catch(() => {
        if (!active) return;
        setRanking(null);
        setRankingState("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    rankingCollection,
    dataMode,
    maxDistanceKm,
    project,
    requiredImportMw,
    setRankingState,
    setRanking,
    setSelectedOpportunitySnapshot,
    setSelected,
  ]);
}
