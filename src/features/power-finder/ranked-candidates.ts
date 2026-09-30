import { supabase } from "@/integrations/supabase/client";
import {
  parseDatabaseRanking,
  rankPublishedCandidates,
  type RankedCandidateResult,
} from "./candidate-intelligence";
import type { PowerFinderCollection } from "./fixture-data";
import type { PowerFinderDataMode } from "./data-source";

export async function loadRankedCandidates(
  collection: PowerFinderCollection,
  requiredImportMw: number,
  maxDistanceKm: number,
  dataMode: PowerFinderDataMode,
): Promise<RankedCandidateResult> {
  if (dataMode === "database") {
    const { data, error } = await supabase.rpc("power_finder_ranked_candidates", {
      required_import_mw: requiredImportMw,
      max_distance_km: maxDistanceKm,
      result_limit: 25,
    });
    if (!error && data) {
      try {
        return parseDatabaseRanking(data, requiredImportMw, maxDistanceKm);
      } catch {
        // Continue with the accepted release if the database response contract has drifted.
      }
    }
  }
  return rankPublishedCandidates(collection, requiredImportMw, maxDistanceKm);
}
