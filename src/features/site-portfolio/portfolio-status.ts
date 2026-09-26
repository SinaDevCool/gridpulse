import type { AnonymousSiteStage } from "@/features/anonymous-workspace/portfolio-projection";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";

export const portfolioViews = ["pipeline", "readiness", "decisions"] as const;
export type PortfolioView = (typeof portfolioViews)[number];

export const portfolioStages = [
  "all",
  "action_required",
  "draft",
  "screening",
  "shortlisted",
  "evidence_review",
  "decision_ready",
] as const;
export type PortfolioStageFilter = (typeof portfolioStages)[number];

export const portfolioDecisions = ["all", "unreviewed", "advance", "hold", "reject"] as const;
export type PortfolioDecisionFilter = (typeof portfolioDecisions)[number];

export const portfolioStageLabels: Record<AnonymousSiteStage, string> = {
  draft: "Draft",
  screening: "Screening",
  shortlisted: "Candidate Shortlisted",
  evidence_review: "Evidence Review",
  decision_ready: "Decision Ready",
};

export const decisionLabels: Record<AnonymousProperty["decisionStatus"], string> = {
  unreviewed: "Unreviewed",
  advance: "Advance",
  hold: "Hold",
  reject: "Reject",
};
