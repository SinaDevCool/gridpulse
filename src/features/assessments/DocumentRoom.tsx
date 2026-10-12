import { useState,type FormEvent } from "react";

import { Download,FileText,LoaderCircle,Trash2,Upload } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { label,type AssessmentDocument,type CandidateSite } from "@/lib/assessment-model";

export function DocumentRoom({
  site,
  documents,
  refresh,
}: {
  site: CandidateSite;
  documents: AssessmentDocument[];
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get("file");
    if (!(file instanceof File) || file.size === 0) return toast.error("Choose a document");
    if (file.size > 25 * 1024 * 1024) return toast.error("Files must be 25 MB or smaller");
    const mimeType = allowedDocumentMimeType(file);
    if (!mimeType) return toast.error("Only PDF, CSV, PNG, and JPEG files are supported");
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${site.user_id}/${site.id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage.from("assessment-documents").upload(path, file, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploaded.error) {
      setBusy(false);
      return toast.error(uploaded.error.message);
    }
    const inserted = await supabase.from("assessment_documents").insert({
      site_id: site.id,
      user_id: site.user_id,
      file_name: file.name,
      storage_path: path,
      mime_type: mimeType,
      size_bytes: file.size,
      document_type: String(values.get("documentType")),
      source_classification: String(values.get("sourceClassification")),
      notes: String(values.get("notes") || "") || null,
    });
    if (inserted.error) {
      await supabase.storage.from("assessment-documents").remove([path]);
      setBusy(false);
      return toast.error(inserted.error.message);
    }
    form.reset();
    setBusy(false);
    toast.success("Document stored securely");
    await refresh();
  }
  async function download(document: AssessmentDocument) {
    const { data, error } = await supabase.storage
      .from("assessment-documents")
      .createSignedUrl(document.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function remove(document: AssessmentDocument) {
    if (!window.confirm(`Delete ${document.file_name}?`)) return;
    const storageResult = await supabase.storage
      .from("assessment-documents")
      .remove([document.storage_path]);
    if (storageResult.error) return toast.error(storageResult.error.message);
    const { error } = await supabase.from("assessment_documents").delete().eq("id", document.id);
    if (error) return toast.error(error.message);
    toast.success("Document deleted");
    await refresh();
  }
  return (
    <div className="activation-layout">
      <form className="workspace-card activation-form" onSubmit={upload}>
        <div className="panel-heading">
          <div>
            <h2>Secure document upload</h2>
            <p>Private PDF, CSV or image evidence. Maximum 25 MB per file.</p>
          </div>
          <Upload />
        </div>
        <label>
          File
          <input name="file" type="file" accept=".pdf,.csv,.png,.jpg,.jpeg" required />
        </label>
        <div className="form-grid two-columns">
          <label>
            Document type
            <select name="documentType" defaultValue="project_brief">
              <option value="project_brief">Project brief</option>
              <option value="site_plan">Site plan</option>
              <option value="single_line_diagram">Single-line diagram</option>
              <option value="technical_specification">Technical specification</option>
              <option value="load_profile">Load profile</option>
              <option value="operator_correspondence">Operator correspondence</option>
              <option value="connection_offer">Connection offer</option>
              <option value="fca_schedule">FCA schedule</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Source
            <select name="sourceClassification" defaultValue="customer_input">
              <option value="customer_input">Customer input</option>
              <option value="operator_source">Network operator</option>
              <option value="official_source">Official source</option>
              <option value="third_party">Third party</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" rows={3} placeholder="Purpose, version or evidence limitations" />
        </label>
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? <LoaderCircle className="spin" /> : <Upload />} Upload document
        </button>
      </form>
      <section className="workspace-card activation-list">
        <div className="panel-heading">
          <div>
            <h2>Project document room</h2>
            <p>{documents.length} files retained with source and review status.</p>
          </div>
          <FileText />
        </div>
        {documents.length === 0 ? (
          <div className="compact-empty">No project documents uploaded.</div>
        ) : (
          documents.map((document) => (
            <article className="activation-row" key={document.id}>
              <div>
                <b>{document.file_name}</b>
                <small>
                  {label(document.document_type)} · {label(document.source_classification)} ·{" "}
                  {(document.size_bytes / 1024).toFixed(0)} KB
                </small>
              </div>
              <span className="status">{label(document.review_status)}</span>
              <button
                aria-label={`Download ${document.file_name}`}
                onClick={() => void download(document)}
              >
                <Download />
              </button>
              <button
                className="danger-button"
                aria-label={`Delete ${document.file_name}`}
                onClick={() => void remove(document)}
              >
                <Trash2 />
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function allowedDocumentMimeType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    csv: "text/csv",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  const inferred = extension ? byExtension[extension] : undefined;
  const allowed = new Set(Object.values(byExtension));
  return allowed.has(file.type) ? file.type : inferred;
}
