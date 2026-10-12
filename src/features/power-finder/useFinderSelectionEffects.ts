import { opportunityNode } from "@/features/power-finder/candidate-intelligence";
import { useEffect } from "react";
import type { FinderControllerContract } from "./controller-contract";
type Context = Pick<
  FinderControllerContract,
  | "search"
  | "collection"
  | "selected"
  | "setSelected"
  | "detailPanelRef"
  | "updateSearch"
  | "setInteractionNotice"
  | "detailDismissedRef"
  | "rankingCollection"
  | "candidates"
  | "selectedOpportunity"
  | "selectedDetailFeature"
  | "closeDetail"
>;
export function useFinderSelectionEffects(context: Context) {
  const {
    search,
    collection,
    selected,
    setSelected,
    detailPanelRef,
    updateSearch,
    setInteractionNotice,
    detailDismissedRef,
    rankingCollection,
    candidates,
    selectedOpportunity,
    selectedDetailFeature,
    closeDetail,
  } = context;
  useEffect(() => {
    if (!search.propertyId || search.candidate || !candidates.length || detailDismissedRef.current)
      return;
    const recommended = candidates[0];
    setInteractionNotice(
      `${recommended.nodeName} is the highest-ranked connection hypothesis for investigation. Capacity remains unconfirmed.`,
    );
    void updateSearch({ candidate: recommended.id });
    // Only recommend automatically when a saved site enters Finder without a durable selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, search.candidate, search.propertyId]);
  useEffect(() => {
    if (!selectedDetailFeature) return;
    const frame = window.requestAnimationFrame(() => detailPanelRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void closeDetail();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
    // The selected feature identity controls panel focus; closeDetail intentionally uses current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDetailFeature?.id]);
  useEffect(() => {
    if (!selectedOpportunity || selected?.id === selectedOpportunity.nodeId) return;
    const node =
      opportunityNode(selectedOpportunity, rankingCollection) ??
      opportunityNode(selectedOpportunity, collection);
    if (node) setSelected(node);
  }, [collection, rankingCollection, selected?.id, selectedOpportunity, setSelected]);
  useEffect(() => {
    if (!search.candidate) return;
    const card = document.querySelector<HTMLElement>(
      `[data-candidate-id="${CSS.escape(search.candidate)}"]`,
    );
    card?.scrollIntoView({ block: "nearest" });
  }, [search.candidate]);
}
