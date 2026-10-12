import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleOperationsRun } from "@/lib/operations-runs-api";

export const Route = createFileRoute("/api/operations/runs")({
  server: { handlers: { POST: ({ request }) => handleOperationsRun(request, env) } },
});
