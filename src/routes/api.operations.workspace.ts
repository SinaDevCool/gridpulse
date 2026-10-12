import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleOperationsWorkspace, type OperationsWorkspaceEnv } from "@/lib/operations-workspace-api";

export const Route = createFileRoute("/api/operations/workspace")({
  server: { handlers: { GET: ({ request }) => handleOperationsWorkspace(request, env as OperationsWorkspaceEnv) } },
});
