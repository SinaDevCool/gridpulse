import { type FormEvent } from "react";

import { Plus,Zap } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import {
label,
type AssessmentDocument,
type CandidateSite,
type FcaEnvelope,
} from "@/lib/assessment-model";

export function EnvelopeRoom({
  site,
  documents,
  envelopes,
  refresh,
}: {
  site: CandidateSite;
  documents: AssessmentDocument[];
  envelopes: FcaEnvelope[];
  refresh: () => Promise<void>;
}) {
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const previous = envelopes[0];
    const { error } = await supabase.from("fca_envelopes").insert({
      site_id: site.id,
      user_id: site.user_id,
      name: String(values.get("name")),
      mode: String(values.get("mode")),
      max_import_mw: values.get("maxImport") ? Number(values.get("maxImport")) : null,
      max_export_mw: values.get("maxExport") ? Number(values.get("maxExport")) : null,
      valid_from: values.get("validFrom")
        ? new Date(String(values.get("validFrom"))).toISOString()
        : null,
      valid_to: values.get("validTo")
        ? new Date(String(values.get("validTo"))).toISOString()
        : null,
      status: String(values.get("status")),
      source_document_id: String(values.get("sourceDocumentId") || "") || null,
      supersedes_id: previous?.id ?? null,
      restriction_schedule: { description: String(values.get("schedule") || "") },
      notes: String(values.get("notes") || "") || null,
    });
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("New FCA envelope version created");
    await refresh();
  }
  return (
    <div className="activation-layout">
      <form className="workspace-card activation-form" onSubmit={add}>
        <div className="panel-heading">
          <div>
            <h2>Create envelope version</h2>
            <p>Limits remain proposals until supported by operator evidence.</p>
          </div>
          <Zap />
        </div>
        <label>
          Name
          <input name="name" placeholder="e.g. Operator proposal 2026-07" required />
        </label>
        <div className="form-grid two-columns">
          <label>
            Mode
            <select name="mode" defaultValue="static">
              <option value="static">Static</option>
              <option value="scheduled">Scheduled</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="operator_proposed">Operator proposed</option>
              <option value="agreed">Agreed</option>
            </select>
          </label>
          <label>
            Max import (MW)
            <input name="maxImport" type="number" min="0" step="0.001" />
          </label>
          <label>
            Max export (MW)
            <input name="maxExport" type="number" min="0" step="0.001" />
          </label>
          <label>
            Valid from
            <input name="validFrom" type="datetime-local" />
          </label>
          <label>
            Valid to
            <input name="validTo" type="datetime-local" />
          </label>
        </div>
        <label>
          Operator evidence
          <select name="sourceDocumentId" defaultValue="">
            <option value="">No operator evidence linked</option>
            {documents
              .filter((item) => item.source_classification === "operator_source")
              .map((document) => (
                <option value={document.id} key={document.id}>
                  {document.file_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Schedule or dispatch rule
          <textarea
            name="schedule"
            rows={3}
            placeholder="Describe fixed windows, day-ahead schedule or dynamic signal"
          />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <button className="primary-button" type="submit">
          <Plus /> Create version
        </button>
      </form>
      <section className="workspace-card activation-list">
        <div className="panel-heading">
          <div>
            <h2>FCA envelope history</h2>
            <p>Immutable versions preserve the operator decision trail.</p>
          </div>
          <Zap />
        </div>
        {envelopes.length === 0 ? (
          <div className="compact-empty">No connection envelope versions created.</div>
        ) : (
          envelopes.map((envelope, index) => (
            <article
              className={index === 0 ? "envelope-card current" : "envelope-card"}
              key={envelope.id}
            >
              <div>
                <span>Version {envelope.version}</span>
                <h3>{envelope.name}</h3>
                <small>
                  {label(envelope.mode)} · created{" "}
                  {new Date(envelope.created_at).toLocaleDateString()}
                </small>
              </div>
              <span className="status">{label(envelope.status)}</span>
              <dl>
                <div>
                  <dt>Import</dt>
                  <dd>{envelope.max_import_mw ?? "—"} MW</dd>
                </div>
                <div>
                  <dt>Export</dt>
                  <dd>{envelope.max_export_mw ?? "—"} MW</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{envelope.source_document_id ? "Linked" : "Required"}</dd>
                </div>
              </dl>
              {envelope.notes ? <p>{envelope.notes}</p> : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
