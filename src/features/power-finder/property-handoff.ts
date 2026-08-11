import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProject } from "./finder-project";

export async function saveFinderProjectToPortfolio(
  project: FinderProject,
  candidates: CandidateOpportunity[],
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to save this project to the property portfolio.");
  if (project.latitude == null || project.longitude == null)
    throw new Error("Set property coordinates before saving to the portfolio.");
  const candidateSnapshots = candidates.map((candidate) => ({
    id: candidate.id,
    nodeName: candidate.nodeName,
    operator: candidate.operator,
    voltageKv: candidate.voltageKv.length ? Math.max(...candidate.voltageKv) : null,
    distanceKm: candidate.distanceKm,
    evidenceClass: "open_mapping",
    capacityState: "not_established",
    screeningRank: candidate.screeningRank,
    evidenceScore: candidate.evidenceScore,
    missingEvidence: candidate.missingEvidence,
    calculationVersion: candidate.calculationVersion,
  }));
  const payload = {
    ...project,
    selectedCandidateIds: candidates.map((candidate) => candidate.id),
    confidentialityClassification: "confidential",
    requiredTotalSiteLoadMw: project.importMw,
    sourceSystem: "gridpulse_power_finder",
  };
  const { data, error } = await supabase.rpc("save_finder_property", {
    p_project: payload as unknown as Json,
    p_candidates: candidateSnapshots as unknown as Json,
  });
  if (error) throw error;
  return data;
}
