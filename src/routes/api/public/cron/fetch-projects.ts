import { createFileRoute } from "@tanstack/react-router";

// Cron-secured endpoint. Called by pg_cron with the project's anon key in the
// `apikey` header. Scans recent unprocessed articles, extracts BESS project
// data via Lovable AI, and upserts into the projects table.
export const Route = createFileRoute("/api/public/cron/fetch-projects")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!expected || !apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const { runProjectPipeline } = await import("@/lib/project-pipeline.server");
          const url = new URL(request.url);
          const limitParam = url.searchParams.get("limit");
          const limit = limitParam ? Math.min(50, Math.max(1, Number(limitParam))) : 12;
          const result = await runProjectPipeline({ triggeredBy: "cron", limit });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("Project ingestion cron failed:", msg);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
