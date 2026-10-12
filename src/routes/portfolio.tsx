import {
  portfolioDecisions,
  portfolioStages,
  portfolioViews,
} from "@/features/site-portfolio/portfolio-status";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { PortfolioWorkspacePresentation } from "./../features/site-portfolio/PortfolioWorkspacePresentation";
import { usePortfolioWorkspace } from "./../features/site-portfolio/use-portfolio-workspace";

const stages = portfolioStages;
const decisions = portfolioDecisions;

export const Route = createFileRoute("/portfolio")({
  validateSearch: z.object({
    q: z.string().max(160).optional(),
    view: z.enum(portfolioViews).optional(),
    stage: z.enum(stages).optional(),
    decision: z.enum(decisions).optional(),
    sort: z.enum(["priority", "updated", "name", "mw"]).optional(),
    risk: z.enum(["all", "blocked", "deadline", "operator_confirmed"]).optional(),
    operator: z.string().max(160).optional(),
    selected: z.string().uuid().optional(),
    import: z.literal("open").optional(),
  }),
  head: () => ({
    meta: [{ title: "Sites | GridPulse" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SitePipeline,
});

function SitePipeline() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/portfolio/")) return <Outlet />;
  return <SitePipelineIndex />;
}

function SitePipelineIndex() {
  return <PortfolioWorkspacePresentation model={usePortfolioWorkspace()} />;
}
