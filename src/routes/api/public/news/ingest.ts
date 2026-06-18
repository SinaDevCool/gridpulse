import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint. Called by pg_cron with the project's anon key in the `apikey`
// header (the canonical pattern). The /api/public/* prefix already bypasses
// Lovable's edge auth on the published site, so we only enforce the apikey
// header to keep random internet callers out.
export const Route = createFileRoute("/api/public/news/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!expected || !apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const { runNewsPipeline } = await import("@/lib/news-pipeline.server");
          const result = await runNewsPipeline({ triggeredBy: "cron" });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("Cron ingestion failed:", msg);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
