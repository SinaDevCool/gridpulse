import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { GitCompareArrows, MapPin, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Candidate = {
  id: string;
  source_feature_id: string;
  feature_kind: string;
  candidate_name: string;
  operator_name: string | null;
  voltage_kv: number | null;
  distance_km: number | null;
  evidence_class: string;
  capacity_state: string;
  context_score: number | null;
  status: string;
  selection_rationale: string | null;
};
type Shortlist = { id: string; title: string; feature_kind: string; source_feature_id: string };

const label = (value: string) => value.replaceAll("_", " ");

export function ConnectionCandidatePanel({ siteId }: { siteId: string }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["project-map-candidates", siteId],
    queryFn: async () => {
      const [candidates, shortlist] = await Promise.all([
        supabase
          .from("project_connection_candidates")
          .select("*")
          .eq("site_id", siteId)
          .order("created_at"),
        supabase
          .from("power_finder_shortlists")
          .select("id,title,feature_kind,source_feature_id")
          .is("assessment_site_id", null)
          .in("feature_kind", ["node", "industrial_site"])
          .order("updated_at", { ascending: false }),
      ]);
      if (candidates.error) throw candidates.error;
      if (shortlist.error) throw shortlist.error;
      return {
        candidates: (candidates.data ?? []) as Candidate[],
        shortlist: (shortlist.data ?? []) as Shortlist[],
      };
    },
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["project-map-candidates", siteId] });

  async function attach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    const result = await supabase.rpc("attach_shortlist_candidate", {
      p_site_id: siteId,
      p_shortlist_id: data.get("shortlist_id"),
    });
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    toast.success("Mapped candidate attached");
    await refresh();
  }

  async function prefer(event: FormEvent<HTMLFormElement>, candidateId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    const result = await supabase.rpc("set_preferred_connection_candidate", {
      p_candidate_id: candidateId,
      p_rationale: data.get("rationale"),
    });
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    toast.success("Preferred candidate recorded with rationale");
    await refresh();
  }

  return (
    <section className="workspace-card connection-candidate-panel">
      <div className="panel-heading">
        <div>
          <h2>Mapped connection candidates</h2>
          <p>Compare saved map context without interpreting it as available grid capacity.</p>
        </div>
        <GitCompareArrows />
      </div>
      {query.data?.shortlist.length ? (
        <form className="candidate-attach-form" onSubmit={attach}>
          <label>
            Add from Power Finder shortlist
            <select name="shortlist_id" required>
              {query.data.shortlist.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title} · {label(item.feature_kind)}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" disabled={busy}>
            <Plus /> Attach candidate
          </button>
        </form>
      ) : null}
      <div className="candidate-comparison-grid">
        {query.data?.candidates.map((candidate) => (
          <article
            className={candidate.status === "preferred" ? "preferred" : ""}
            key={candidate.id}
          >
            <header>
              <MapPin />
              <div>
                <span>{label(candidate.feature_kind)}</span>
                <h3>{candidate.candidate_name}</h3>
              </div>
              <b>{label(candidate.status)}</b>
            </header>
            <dl>
              <div>
                <dt>Operator</dt>
                <dd>{candidate.operator_name ?? "Confirmation required"}</dd>
              </div>
              <div>
                <dt>Voltage</dt>
                <dd>{candidate.voltage_kv ? `${candidate.voltage_kv} kV` : "Unknown"}</dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>
                  {candidate.distance_km == null ? "Not calculated" : `${candidate.distance_km} km`}
                </dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{label(candidate.evidence_class)}</dd>
              </div>
              <div>
                <dt>Capacity</dt>
                <dd className="warning-text">{label(candidate.capacity_state)}</dd>
              </div>
              <div>
                <dt>Context score</dt>
                <dd>
                  {candidate.context_score == null
                    ? "Not scored"
                    : `${candidate.context_score}/100`}
                </dd>
              </div>
            </dl>
            {candidate.status === "preferred" ? (
              <p className="candidate-rationale">
                <ShieldCheck /> {candidate.selection_rationale}
              </p>
            ) : (
              <form onSubmit={(event) => void prefer(event, candidate.id)}>
                <label>
                  Selection rationale
                  <textarea name="rationale" minLength={10} rows={2} required />
                </label>
                <button className="secondary-button" disabled={busy}>
                  Set preferred
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
      {!query.isLoading && !query.data?.candidates.length ? (
        <div className="compact-empty">
          Save a node or industrial site in Power Finder, then attach it here.
        </div>
      ) : null}
      <footer className="candidate-boundary">
        Context score measures source completeness and authority. It is not a connection
        probability, offer, cost estimate or capacity reservation.
      </footer>
    </section>
  );
}
