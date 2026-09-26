import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handlePublicGridStressRequest } from "@/lib/public-grid-stress-api";
import type { PublicFinderEnv } from "@/lib/public-power-finder-api";

export const Route = createFileRoute("/api/forecasts/grid-stress/current")({
  server: { handlers: { GET: ({ request }) => handlePublicGridStressRequest(request, env as PublicFinderEnv) as Promise<Response> } },
});
