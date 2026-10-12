import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleOperationsIngest, type OperationsIngestEnv } from "@/lib/operations-ingest-api";

export const Route = createFileRoute("/api/operations/ingest")({
  server: {
    handlers: {
      POST: ({ request }) => handleOperationsIngest(request, env as OperationsIngestEnv),
    },
  },
});
