import { opportunityNode, type CandidateOpportunity } from "./candidate-intelligence";
import type { FinderControllerContract } from "./controller-contract";

type SelectionContext = Pick<
  FinderControllerContract,
  | "collection"
  | "rankingCollection"
  | "setSelected"
  | "setSelectedOpportunitySnapshot"
  | "navigateMapToPoint"
  | "setInteractionNotice"
  | "updateSearch"
>;

/** One selection path for cards and the table; missing geometry is never invented. */
export async function selectFinderCandidate(
  model: SelectionContext,
  candidate: CandidateOpportunity,
) {
  const node =
    opportunityNode(candidate, model.rankingCollection) ??
    opportunityNode(candidate, model.collection);
  if (!node) {
    model.setInteractionNotice(
      "This candidate's mapped geometry is unavailable. Refresh the search before selecting it.",
    );
    return;
  }
  model.setSelectedOpportunitySnapshot(candidate);
  model.setSelected(node);
  if (node.geometry.type === "Point")
    model.navigateMapToPoint(node.geometry.coordinates as [number, number]);
  model.setInteractionNotice(`${candidate.nodeName} selected and highlighted on the map.`);
  await model.updateSearch({ candidate: candidate.id });
  model.setSelectedOpportunitySnapshot(candidate);
  model.setSelected(node);
}
