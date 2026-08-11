import { propertyFromFinder } from "@/features/anonymous-workspace/factory";
import { getAnonymousProperty, saveAnonymousProperty } from "@/features/anonymous-workspace/repository";
import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProject } from "./finder-project";

export async function saveFinderProjectToPortfolio(project: FinderProject, candidates: CandidateOpportunity[], propertyId?: string): Promise<string> {
  const existing = propertyId ? await getAnonymousProperty(propertyId) : null;
  const property = propertyFromFinder(project, candidates, existing);
  await saveAnonymousProperty(property);
  return property.id;
}
