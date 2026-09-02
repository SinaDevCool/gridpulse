import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import {
  handlePublicPowerFinderRequest,
  type PublicFinderEnv,
} from "@/lib/public-power-finder-api";

export const Route = createFileRoute("/api/power-finder/viewport")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handlePublicPowerFinderRequest(request, env as PublicFinderEnv).then(
          (response) =>
            response ??
            new Response(JSON.stringify({ error: "Public Finder route not found." }), {
              status: 404,
              headers: { "content-type": "application/json; charset=utf-8" },
            }),
        ),
    },
  },
});
