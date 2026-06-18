import { createFileRoute } from "@tanstack/react-router";

// Cron-triggered alert matcher. Schedules call this with the project anon key
// in the `apikey` header (the canonical pattern for /api/public/*).
export const Route = createFileRoute("/api/public/alerts/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") || request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!expected || !apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        let body: { frequency?: string } = {};
        try {
          body = (await request.json()) as { frequency?: string };
        } catch {
          /* ignore */
        }
        const freq = (body.frequency ?? "all") as
          | "instant"
          | "daily"
          | "weekly"
          | "all";

        try {
          const { runAlertMatcher } = await import("@/lib/alerts.server");
          const result = await runAlertMatcher(freq);
          return Response.json({ ok: true, frequency: freq, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("Alert matcher failed:", msg);
          return new Response(
            JSON.stringify({ ok: false, error: msg }),
            {
              status: 500,
              headers: { "content-type": "application/json" },
            },
          );
        }
      },
    },
  },
});
