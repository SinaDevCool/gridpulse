import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import {
  handlePublicPowerFinderTileRequest,
  type PublicFinderEnv,
} from "@/lib/public-power-finder-api";

export const Route = createFileRoute("/api/power-finder/tile/$z/$x/$y")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handlePublicPowerFinderTileRequest(request, env as PublicFinderEnv).then(
          (response) => response ?? new Response(null, { status: 404 }),
        ),
    },
  },
});
