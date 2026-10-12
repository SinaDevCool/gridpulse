import { useState,type FormEvent } from "react";

import { ExternalLink,Plus,Trash2 } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { label,type CandidateSite,type Evidence } from "@/lib/assessment-model";

export function EvidenceRoom({
  site,
  evidence,
  refresh,
}: {
  site: CandidateSite;
  evidence: Evidence[];
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const f = new FormData(event.currentTarget);
    const { error } = await supabase.from("assessment_evidence").insert({
      site_id: site.id,
      user_id: site.user_id,
      title: String(f.get("title")),
      classification: String(f.get("classification")),
      source_name: String(f.get("sourceName") || "") || null,
      source_url: String(f.get("sourceUrl") || "") || null,
      observed_at: String(f.get("observedAt") || "") || null,
      confidence: String(f.get("confidence")),
      validation_status: String(f.get("status")),
      notes: String(f.get("notes") || "") || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setOpen(false);
      toast.success("Evidence added");
      await refresh();
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("assessment_evidence").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  async function setStatus(id: string, validation_status: string) {
    const { error } = await supabase
      .from("assessment_evidence")
      .update({ validation_status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  return (
    <div className="workspace-stack">
      <div className="workspace-toolbar">
        <div>
          <h2>Evidence ledger</h2>
          <p>Every item has an explicit source and validation state.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen((v) => !v)}>
          <Plus />
          Add evidence
        </button>
      </div>
      {open ? (
        <form className="inline-editor" onSubmit={add}>
          <label>
            Evidence title
            <input name="title" required placeholder="e.g. Operator connection rules" />
          </label>
          <div className="form-grid">
            <label>
              Classification
              <select name="classification">
                <option value="official_source">Official source</option>
                <option value="customer_input">Customer input</option>
                <option value="assumption">Assumption</option>
                <option value="calculation">Calculation</option>
                <option value="operator_validation_required">Operator validation required</option>
              </select>
            </label>
            <label>
              Validation status
              <select name="status">
                <option value="collected">Collected</option>
                <option value="unverified">Unverified</option>
                <option value="validated">Validated</option>
                <option value="missing">Missing</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Source name
              <input name="sourceName" />
            </label>
            <label>
              Source URL
              <input name="sourceUrl" type="url" placeholder="https://" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Observed date
              <input name="observedAt" type="date" />
            </label>
            <label>
              Confidence
              <select name="confidence">
                <option value="unknown">Unknown</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <div className="editor-actions">
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="primary-button" disabled={busy}>
              Save evidence
            </button>
          </div>
        </form>
      ) : null}
      <div className="data-panel">
        <div className="table-scroll">
          <table className="product-table">
            <thead>
              <tr>
                <th>Evidence</th>
                <th>Source</th>
                <th>Classification</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {evidence.length === 0 ? (
                <tr>
                  <td colSpan={5}>No evidence has been recorded.</td>
                </tr>
              ) : (
                evidence.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.title}</b>
                      <small>{item.notes}</small>
                    </td>
                    <td>
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          {item.source_name || "Open source"} <ExternalLink />
                        </a>
                      ) : (
                        item.source_name || "—"
                      )}
                    </td>
                    <td>
                      <span className="evidence evidence-input">{label(item.classification)}</span>
                    </td>
                    <td>
                      <select
                        className="table-select"
                        value={item.validation_status}
                        onChange={(event) => void setStatus(item.id, event.target.value)}
                        aria-label={`Validation status for ${item.title}`}
                      >
                        <option value="unverified">Unverified</option>
                        <option value="collected">Collected</option>
                        <option value="validated">Validated</option>
                        <option value="missing">Missing</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="icon-button danger-button"
                        onClick={() => void remove(item.id)}
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
