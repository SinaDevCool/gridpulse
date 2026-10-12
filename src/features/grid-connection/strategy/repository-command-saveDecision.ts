import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite,Evidence,OperatorPackage,Scenario } from "@/lib/assessment-model";
export function selectConnectionDecisions1(site: CandidateSite) {
  return supabase
    .from("connection_decisions")
    .select("version")
    .eq("site_id", site.id)
    .order("version", { ascending: false })
    .limit(1);
}

export function insertConnectionDecisions2(
  site: CandidateSite,
  preferredScenario: Scenario,
  packages: OperatorPackage[],
  decisionVersion: number,
  scenarios: Scenario[],
  evidence: Evidence[],
  rationale: string | undefined,
) {
  return supabase
    .from("connection_decisions")
    .insert({
      site_id: site.id,
      scenario_id: preferredScenario.id,
      package_id: packages[0]?.id ?? null,
      version: decisionVersion,
      status: "draft",
      rationale,
      alternatives_rejected: scenarios
        .filter((item) => item.id !== preferredScenario.id)
        .map((item) => ({ id: item.id, name: item.name })),
      conditions_to_proceed: [
        "Written operator confirmation",
        "Technical study",
        "Commercial approval",
      ],
      assumptions: [
        "No available capacity is inferred",
        "All limits are declared or operator-supplied",
      ],
      evidence_ids: evidence.map((item) => item.id),
    })
    .select("id")
    .single();
}

export function insertAssessmentMilestones3(
  actionTitles: string[],
  site: CandidateSite,
  now: number,
  decisionVersion: number,
  decision: { id: string },
) {
  return supabase.from("assessment_milestones").insert(
    actionTitles.map((title, index) => ({
      site_id: site.id,
      user_id: site.user_id,
      title,
      milestone_type: "strategy_execution",
      status: "open",
      due_at: new Date(now + (index + 1) * 14 * 86_400_000).toISOString(),
      notes: `Generated from decision v${decisionVersion} (${decision.id}).`,
    })),
  );
}

export function insertAssessmentActivity4(
  site: CandidateSite,
  decision: { id: string },
  decisionVersion: number,
  preferredScenario: Scenario,
  packages: OperatorPackage[],
) {
  return supabase.from("assessment_activity").insert({
    site_id: site.id,
    actor_id: site.user_id,
    event_type: "decision_created",
    entity_type: "connection_decision",
    entity_id: decision.id,
    summary: `Decision v${decisionVersion} created for ${preferredScenario.name}`,
    details: { scenarioId: preferredScenario.id, packageId: packages[0]?.id ?? null },
  });
}
