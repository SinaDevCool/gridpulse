import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runNewsIngestion, listIngestionRuns } from "@/utils/news.functions";
import { getDataAudit, type DataAuditCounts } from "@/utils/data-audit.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — GridPulse" }] }),
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: context.user.id,
      _role: "admin",
    });
    if (error || !data) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  fetched_count: number;
  inserted_count: number;
  summarized_count: number;
  failed_count: number;
  error: string | null;
  triggered_by: string;
};

function AdminPage() {
  const qc = useQueryClient();
  const runFn = useServerFn(runNewsIngestion);
  const listFn = useServerFn(listIngestionRuns);
  const auditFn = useServerFn(getDataAudit);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const runsQ = useQuery<Run[]>({
    queryKey: ["ingestion_runs"],
    queryFn: () => listFn() as Promise<Run[]>,
    refetchInterval: 5000,
  });

  const auditQ = useQuery<DataAuditCounts>({
    queryKey: ["data_audit"],
    queryFn: () => auditFn() as Promise<DataAuditCounts>,
    refetchInterval: 30_000,
  });

  const mut = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (res) => {
      if ("ok" in res && res.ok) {
        setLastResult(
          `Inserted ${res.inserted} new article${res.inserted === 1 ? "" : "s"} (fetched ${res.fetched}, failed ${res.failed}) in ${(res.durationMs / 1000).toFixed(1)}s.`
        );
        toast.success("Ingestion complete");
      } else {
        const err = "error" in res ? res.error : "Unknown error";
        setLastResult(`Failed: ${err}`);
        toast.error(err);
      }
      qc.invalidateQueries({ queryKey: ["ingestion_runs"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      setLastResult(`Failed: ${msg}`);
      toast.error(msg);
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">
          Admin
        </div>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight">
          News pipeline
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          Trigger an immediate ingest + AI summarization run, or review the latest scheduled runs.
          Cron runs hourly via the public ingest endpoint.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-surface/60 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Run now</h2>
              <p className="text-sm text-muted-foreground">
                Fetches active RSS sources, summarizes new items, and inserts them into the news feed.
              </p>
            </div>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Running…" : "Run ingestion"}
            </Button>
          </div>
          {lastResult && (
            <div className="mt-4 rounded-md bg-background/60 border border-border px-3 py-2 text-sm">
              {lastResult}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="font-semibold mb-3">Recent runs</h2>
          {runsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : runsQ.error ? (
            <div className="text-sm text-destructive">
              {(runsQ.error as Error).message}
            </div>
          ) : (runsQ.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No runs yet.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Started</th>
                    <th className="px-3 py-2 text-left">Trigger</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Fetched</th>
                    <th className="px-3 py-2 text-right">Inserted</th>
                    <th className="px-3 py-2 text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {(runsQ.data ?? []).map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2">{new Date(r.started_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{r.triggered_by}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            r.status === "ok"
                              ? "text-emerald-400"
                              : r.status === "running"
                                ? "text-amber-400"
                                : "text-destructive"
                          }
                        >
                          {r.status}
                        </span>
                        {r.error && (
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {r.error}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{r.fetched_count}</td>
                      <td className="px-3 py-2 text-right">{r.inserted_count}</td>
                      <td className="px-3 py-2 text-right">{r.failed_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 text-sm">
          <Link to="/news" className="text-cyan-accent hover:underline">
            → View news feed
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
