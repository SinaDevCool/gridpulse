import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handlePlanBrief, type CopilotConfig } from "@/server/operations/copilot-handler";

export const Route = createFileRoute("/api/operations/brief")({ server: { handlers: {
  POST: ({ request }) => handlePlanBrief(request, env as unknown as CopilotConfig),
} } });
