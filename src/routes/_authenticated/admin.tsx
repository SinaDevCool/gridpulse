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
import { runProjectIngestion } from "@/utils/projects.functions";
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
  const runProjectsFn = useServerFn(runProjectIngestion);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastProjectResult, setLastProjectResult] = useState<string | null>(null);

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

  const projectMut = useMutation({
    mutationFn: async () => {
      const toastId = toast.loading("Extracting BESS project metrics via Gemini…");
      try {
        const res = await runProjectsFn();
        toast.dismiss(toastId);
        return res;
      } catch (e) {
        toast.dismiss(toastId);
        throw e;
      }
    },
    onSuccess: (res) => {
      if ("ok" in res && res.ok) {
        setLastProjectResult(
          `Scanned ${res.scanned} article${res.scanned === 1 ? "" : "s"} — extracted ${res.extracted}, inserted ${res.inserted} new project${res.inserted === 1 ? "" : "s"}, updated ${res.updated}, skipped ${res.skipped}, failed ${res.failed} in ${(res.durationMs / 1000).toFixed(1)}s.`,
        );
        toast.success(
          `Projects: +${res.inserted} new, ${res.updated} updated (${res.scanned} articles scanned)`,
        );
        qc.invalidateQueries({ queryKey: ["data_audit"] });
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["project"] });
        qc.invalidateQueries({ queryKey: ["companies"] });
        qc.invalidateQueries({ queryKey: ["analytics"] });
        qc.invalidateQueries({ queryKey: ["markets"] });
      } else {
        const err = "error" in res ? res.error : "Unknown error";
        setLastProjectResult(`Failed: ${err}`);
        toast.error(err);
      }
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      setLastProjectResult(`Failed: ${msg}`);
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

        <section className="mt-12">
          <h2 className="font-semibold mb-3">Data audit — live vs. demo / seed</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
            Provenance snapshot of every row in <code>articles</code> and <code>projects</code>. Rows tagged
            <code className="mx-1">seed</code>/<code>demo</code> are not live-sourced and are labeled across the site.
          </p>
          {auditQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading audit…</div>
          ) : auditQ.error ? (
            <div className="text-sm text-destructive">{(auditQ.error as Error).message}</div>
          ) : auditQ.data ? (
            <div className="grid gap-4 md:grid-cols-2">
              <AuditCard
                title="Articles"
                total={auditQ.data.articles.total}
                bySourceType={auditQ.data.articles.bySourceType}
                byVerification={auditQ.data.articles.byVerification}
                withSource={auditQ.data.articles.withSourceUrl}
                withoutSource={auditQ.data.articles.withoutSourceUrl}
                lastEvent={auditQ.data.articles.latestFetchedAt}
                lastEventLabel="Latest fetched_at"
              />
              <AuditCard
                title="Projects"
                total={auditQ.data.projects.total}
                bySourceType={auditQ.data.projects.bySourceType}
                byVerification={auditQ.data.projects.byVerification}
                withSource={auditQ.data.projects.withSourceUrls}
                withoutSource={auditQ.data.projects.withoutSourceUrls}
                lastEvent={auditQ.data.projects.latestVerifiedAt}
                lastEventLabel="Latest last_verified_at"
              />
            </div>
          ) : null}
        </section>

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

function AuditCard({
  title,
  total,
  bySourceType,
  byVerification,
  withSource,
  withoutSource,
  lastEvent,
  lastEventLabel,
}: {
  title: string;
  total: number;
  bySourceType: Record<string, number>;
  byVerification: Record<string, number>;
  withSource: number;
  withoutSource: number;
  lastEvent: string | null;
  lastEventLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/60 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="font-mono-data text-sm text-muted-foreground">{total} rows</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <BreakdownRow label="By source_type" entries={bySourceType} />
        <BreakdownRow label="By verification_status" entries={byVerification} />
        <div className="flex justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
          <span>With source URL(s)</span>
          <span className="font-mono-data text-foreground">
            {withSource} / {total - withSource - withoutSource + withSource + withoutSource > 0 ? total : total}
            {" "}({total > 0 ? Math.round((withSource / total) * 100) : 0}%)
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{lastEventLabel}</span>
          <span className="font-mono-data text-foreground">
            {lastEvent ? new Date(lastEvent).toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, entries }: { label: string; entries: Record<string, number> }) {
  const keys = Object.keys(entries).sort();
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {keys.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          keys.map((k) => {
            const isDemo = k === "demo" || k === "seed";
            const isGood = k === "verified" || k === "rss";
            const cls = isDemo
              ? "border-amber-accent/40 bg-amber-accent/10 text-amber-accent"
              : isGood
                ? "border-green-accent/40 bg-green-accent/10 text-green-accent"
                : "border-border bg-surface text-muted-foreground";
            return (
              <span key={k} className={`rounded border px-2 py-0.5 text-[11px] font-mono-data ${cls}`}>
                {k}: {entries[k]}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
