import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Network, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/evidence-review")({
  head: () => ({ meta: [{ title: "Evidence Review | GridPulse" }] }),
  component: EvidenceReviewPage,
});

type QueueItem = {
  match_id: string;
  node_id: string;
  node_name: string;
  operator_name: string | null;
  voltage_kv: number[];
  source_record_id: string;
  match_method: string;
  confidence: number;
  distance_m: number | null;
  rationale: string;
  evidence_title: string;
  evidence_url: string;
  project_status: string | null;
  created_at: string;
};

function EvidenceReviewPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["operator-evidence-review-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("operator_evidence_review_queue");
      if (error) throw error;
      return (data ?? []) as QueueItem[];
    },
  });

  async function decide(item: QueueItem, decision: "accepted" | "rejected") {
    const rationale = window.prompt(
      `${decision === "accepted" ? "Why is this the same node?" : "Why should this match be rejected?"}\n\nRecord at least 10 characters for the audit trail.`,
      item.rationale,
    );
    if (!rationale) return;
    setBusyId(item.match_id);
    const { error } = await supabase.rpc("review_operator_node_evidence_match", {
      p_match_id: item.match_id,
      p_decision: decision,
      p_rationale: rationale,
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`Evidence match ${decision}`);
    await queryClient.invalidateQueries({ queryKey: ["operator-evidence-review-queue"] });
  }

  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page evidence-review-page">
        <PageHeading
          eyebrow="Internal evidence control"
          title="Operator node-match review"
          description="Accept only when source identity, voltage, geography, and operator context support the same physical node."
        />
        <div className="truth-banner">
          <ShieldCheck />
          <div>
            <b>Acceptance links evidence—it does not confirm capacity</b>
            <p>
              Proposed matches are invisible in Power Finder. Only accepted links become
              user-visible, and their original caveats remain attached.
            </p>
          </div>
        </div>
        {query.isLoading && <div className="power-finder-loading">Loading review queue…</div>}
        {query.error && (
          <div className="compact-empty">
            {query.error instanceof Error ? query.error.message : "Review queue unavailable."}
          </div>
        )}
        <section className="evidence-review-list">
          {query.data?.map((item) => (
            <article className="workspace-card evidence-review-card" key={item.match_id}>
              <header>
                <Network />
                <span>
                  <h2>{item.node_name}</h2>
                  <p>
                    {item.operator_name ?? "Unknown operator"} ·{" "}
                    {item.voltage_kv.length
                      ? `${item.voltage_kv.join(" / ")} kV`
                      : "unknown voltage"}
                  </p>
                </span>
                <strong>{Math.round(Number(item.confidence) * 100)}%</strong>
              </header>
              <dl>
                <div>
                  <dt>Mapped record</dt>
                  <dd>{item.source_record_id}</dd>
                </div>
                <div>
                  <dt>Method</dt>
                  <dd>{item.match_method.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Distance</dt>
                  <dd>
                    {item.distance_m === null ? "Not used" : `${Math.round(item.distance_m)} m`}
                  </dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>
                    <a href={item.evidence_url} target="_blank" rel="noreferrer">
                      {item.evidence_title} <ExternalLink />
                    </a>
                  </dd>
                </div>
              </dl>
              <p>{item.rationale}</p>
              <footer>
                <button
                  className="secondary-button"
                  disabled={busyId === item.match_id}
                  onClick={() => void decide(item, "rejected")}
                >
                  <XCircle /> Reject
                </button>
                <button
                  className="primary-button"
                  disabled={busyId === item.match_id}
                  onClick={() => void decide(item, "accepted")}
                >
                  <CheckCircle2 /> Accept reviewed match
                </button>
              </footer>
            </article>
          ))}
          {!query.isLoading && query.data?.length === 0 && (
            <div className="workspace-card compact-empty">
              The queue is clear. New connector proposals will appear here before publication.
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
