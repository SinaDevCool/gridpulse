import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Camera, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Snapshot = {
  id: string;
  version: number;
  snapshot_type: string;
  decision_label: string;
  decision_rationale: string;
  state_hash: string;
  created_at: string;
};

export function DecisionSnapshotPanel({ siteId }: { siteId: string }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["decision-snapshots", siteId],
    queryFn: async () => {
      const result = await supabase
        .from("project_decision_snapshots")
        .select("id,version,snapshot_type,decision_label,decision_rationale,state_hash,created_at")
        .eq("site_id", siteId)
        .order("version", { ascending: false });
      if (result.error) throw result.error;
      return (result.data ?? []) as Snapshot[];
    },
  });

  async function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const result = await supabase.rpc("capture_project_decision_snapshot", {
      p_site_id: siteId,
      p_snapshot_type: data.get("snapshot_type"),
      p_decision_label: data.get("decision_label"),
      p_decision_rationale: data.get("decision_rationale"),
    });
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    form.reset();
    toast.success("Immutable decision snapshot captured");
    await client.invalidateQueries({ queryKey: ["decision-snapshots", siteId] });
  }

  return (
    <section className="workspace-card snapshot-panel">
      <div className="panel-heading">
        <div>
          <h2>Decision snapshots</h2>
          <p>Freeze the project and operator evidence used at each material decision.</p>
        </div>
        <Camera />
      </div>
      <form className="snapshot-form" onSubmit={capture}>
        <label>
          Decision stage
          <select name="snapshot_type" required defaultValue="site_selection">
            <option value="site_selection">Site selection</option>
            <option value="operator_submission">Operator submission</option>
            <option value="operator_response">Operator response</option>
            <option value="final_outcome">Final outcome</option>
          </select>
        </label>
        <label>
          Decision label
          <input
            name="decision_label"
            required
            placeholder="Proceed with preferred connection route"
          />
        </label>
        <label className="snapshot-rationale">
          Rationale
          <textarea
            name="decision_rationale"
            required
            minLength={10}
            rows={3}
            placeholder="Why is this decision justified by the available evidence?"
          />
        </label>
        <button className="primary-button" disabled={busy}>
          <Camera /> {busy ? "Capturing…" : "Capture snapshot"}
        </button>
      </form>
      <div className="snapshot-history">
        <h3>
          <History /> Version history
        </h3>
        {query.data?.map((snapshot) => (
          <article key={snapshot.id}>
            <span>
              v{snapshot.version} · {snapshot.snapshot_type.replaceAll("_", " ")}
            </span>
            <b>{snapshot.decision_label}</b>
            <p>{snapshot.decision_rationale}</p>
            <small>
              {new Date(snapshot.created_at).toLocaleString("en-GB")} · integrity{" "}
              {snapshot.state_hash.slice(0, 12)}
            </small>
          </article>
        ))}
        {!query.isLoading && !query.data?.length ? (
          <div className="compact-empty">No decision snapshot captured yet.</div>
        ) : null}
      </div>
    </section>
  );
}
