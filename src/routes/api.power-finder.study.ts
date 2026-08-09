import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handlePublicC1StudyRequest } from "@/lib/public-c1-study-api";
import type { PublicFinderEnv } from "@/lib/public-power-finder-api";

export const Route = createFileRoute("/api/power-finder/study")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handlePublicC1StudyRequest(request, env as PublicFinderEnv).then(
          (result) => result ?? new Response(null, { status: 404 }),
        ),
    },
  },
});
