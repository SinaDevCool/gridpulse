import type { AnonymousProperty } from "../anonymous-workspace/schema";
import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProject } from "./finder-project";

export interface ScreeningRepository {
  save(
    project: FinderProject,
    candidates: CandidateOpportunity[],
    propertyId?: string,
    shortlistedCandidateId?: string | null,
  ): Promise<string>;
  load(id: string): Promise<AnonymousProperty | null>;
}
export async function persistFinderScreening(
  repository: ScreeningRepository,
  input: {
    project: FinderProject;
    candidates: CandidateOpportunity[];
    propertyId?: string;
    shortlistedCandidateId: string | null;
  },
) {
  const propertyId = await repository.save(
    input.project,
    input.candidates,
    input.propertyId,
    input.shortlistedCandidateId,
  );
  const property = await repository.load(propertyId);
  if (!property) throw new Error("The site was saved, but could not be reloaded.");
  return { propertyId, property };
}
