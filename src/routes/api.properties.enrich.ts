import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import type { PublicFinderEnv } from "@/lib/public-power-finder-api";
import { handlePublicPropertyEnrichment } from "@/lib/public-property-enrichment-api";

export const Route = createFileRoute("/api/properties/enrich")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handlePublicPropertyEnrichment(request, env as PublicFinderEnv).then(
          (response) => response ?? new Response(null, { status: 404 }),
        ),
    },
  },
});
