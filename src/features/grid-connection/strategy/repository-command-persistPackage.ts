import { recordedVersionReply } from "./record-contracts";
import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite, Evidence, IntervalProfile, Scenario } from "@/lib/assessment-model";
import type { OperatorPackageSnapshot } from "../deliverables";
import type { FlexibilityResult } from "../domain";
export async function saveOperatorPackage(
  site: CandidateSite,
  snapshot: OperatorPackageSnapshot,
  evidence: Evidence[],
  scenarios: Scenario[],
  result: FlexibilityResult,
  profiles: IntervalProfile[],
  status: "approved" | "draft" | "internal_review" | "issued",
) {
  return recordedVersionReply(
    await supabase.rpc("gridpulse_append_strategy_package", {
      p_site_id: site.id,
      p_package: {
        site_id: site.id,
        status,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
        manifest: {
          evidenceCount: evidence.length,
          scenarioCount: scenarios.length,
          calculationVersion: result.calculationVersion,
          generatedAt: new Date().toISOString(),
        },
        methodology_version: "de-connection-options-v1",
        input_manifest: {
          profileId: profiles[0]?.id ?? null,
          profileVersion: profiles[0]?.version ?? null,
          profileHash: profiles[0]?.source_hash ?? null,
          scenarioIds: scenarios.map((scenario) => scenario.id),
          evidenceIds: evidence.map((item) => item.id),
        },
        issued_at: status === "issued" ? new Date().toISOString() : null,
      },
    }),
  );
}
