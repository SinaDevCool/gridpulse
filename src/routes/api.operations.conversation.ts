import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handlePlanConversation, type CopilotConfig } from "@/server/operations/copilot-handler";

export const Route = createFileRoute("/api/operations/conversation")({ server: { handlers: {
  POST: ({ request }) => handlePlanConversation(request, env as unknown as CopilotConfig),
} } });
