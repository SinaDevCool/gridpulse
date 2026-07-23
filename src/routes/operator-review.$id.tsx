import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { capacityTruth, nodeDisplayName } from "@/features/grid-connection/node-intelligence";
import {
  label,
  type AssessmentDocument,
  type CandidateSite,
  type CapacitySnapshot,
  type NetworkNode,
  type OperatorDecision,
} from "@/lib/assessment-model";

export const Route = createFileRoute("/operator-review/$id")({
  head: () => ({
    meta: [
      { title: "Operator Evidence Review | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OperatorReviewPage,
});

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function OperatorReviewPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["operator-review", id, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [site, nodes, snapshots, documents, decisions, role] = await Promise.all([
        supabase.from("candidate_sites").select("*").eq("id", id).single(),
        supabase.from("network_nodes").select("*").eq("site_id", id).order("created_at"),
        supabase
          .from("capacity_snapshots")
          .select("*")
          .eq("site_id", id)
          .order("version", { ascending: false }),
        supabase
          .from("assessment_documents")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("operator_decisions")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_assessment_role", { p_site_id: id }),
      ]);
      for (const result of [site, nodes, snapshots, documents, decisions, role])
        if (result.error) throw result.error;
      return {
        site: site.data as CandidateSite,
        nodes: nodes.data as NetworkNode[],
        snapshots: snapshots.data as CapacitySnapshot[],
        documents: documents.data as AssessmentDocument[],
        decisions: decisions.data as OperatorDecision[],
        role: String(role.data ?? "none"),
      };
    },
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["operator-review", id] });
  }

  if (query.isLoading)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <div className="loading-spinner" />
          <p>Loading operator review…</p>
        </main>
      </AppShell>
    );
  if (query.error || !query.data)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <AlertTriangle />
          <h1>Review unavailable</h1>
          <p>
            {query.error instanceof Error ? query.error.message : "This invitation is unavailable."}
          </p>
        </main>
      </AppShell>
    );
  const { site, nodes, snapshots, documents, decisions, role } = query.data;
  const isOperator = role === "operator_reviewer";
  const operatorDocuments = documents.filter(
    (document) => document.source_classification === "operator_source",
  );

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !isOperator) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return toast.error("Choose a supporting document");
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${user.id}/${site.id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage
      .from("assessment-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) {
      setBusy(false);
      return toast.error(uploaded.error.message);
    }
    const inserted = await supabase.from("assessment_documents").insert({
      site_id: site.id,
      user_id: user.id,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      document_type: data.get("document_type"),
      source_classification: "operator_source",
      review_status: "uploaded",
      visibility: "reviewers",
      notes: data.get("notes") || null,
    });
    if (inserted.error) {
      await supabase.storage.from("assessment-documents").remove([path]);
      setBusy(false);
      return toast.error(inserted.error.message);
    }
    form.reset();
    setBusy(false);
    toast.success("Operator evidence uploaded");
    await refresh();
  }

  async function signDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOperator) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const decision = String(data.get("decision"));
    const nodeId = String(data.get("node_id"));
    const snapshotId = String(data.get("snapshot_id") || "") || null;
    const documentId = String(data.get("document_id") || "") || null;
    const note = String(data.get("note"));
    if (decision === "confirmed" && (!snapshotId || !documentId))
      return toast.error("Confirmation requires a candidate snapshot and operator-source document");
    const requestedChanges = String(data.get("requested_changes") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const nodeCorrections = {
      node_name: String(data.get("node_name") || ""),
      node_code: String(data.get("node_code") || ""),
      operator_name: String(data.get("operator_name") || ""),
      voltage_kv: String(data.get("voltage_kv") || ""),
    };
    const signedPayload = JSON.stringify({
      site_id: site.id,
      node_id: nodeId,
      candidate_snapshot_id: snapshotId,
      source_document_id: documentId,
      decision,
      statement_scope: data.get("statement_scope"),
      note,
      requestedChanges,
      nodeCorrections,
      valid_from: data.get("valid_from"),
      valid_to: data.get("valid_to"),
      organization: data.get("organization"),
    });
    setBusy(true);
    const { error } = await supabase.rpc("record_operator_node_decision", {
      p_site_id: site.id,
      p_node_id: nodeId,
      p_candidate_snapshot_id: snapshotId,
      p_source_document_id: documentId,
      p_decision: decision,
      p_statement_scope: String(data.get("statement_scope")),
      p_note: note,
      p_requested_changes: requestedChanges,
      p_node_corrections: nodeCorrections,
      p_valid_from: data.get("valid_from")
        ? new Date(String(data.get("valid_from"))).toISOString()
        : null,
      p_valid_to: data.get("valid_to")
        ? new Date(String(data.get("valid_to"))).toISOString()
        : null,
      p_signer_organization: String(data.get("organization")),
      p_content_hash: await sha256(signedPayload),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Signed operator decision recorded");
    await refresh();
  }

  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page operator-review-page">
        <Link to="/portfolio" className="back-link">
          <ArrowLeft /> Portfolio
        </Link>
        <header className="assessment-title">
          <div>
            <p className="context-label">Authenticated operator review</p>
            <h1>{site.name}</h1>
            <p>
              Review project-scoped node and capacity evidence without changing the customer’s
              internal study record.
            </p>
          </div>
          <span className="status">{label(role)}</span>
        </header>
        {!isOperator ? (
          <div className="truth-banner">
            <ShieldCheck />
            <div>
              <b>Observer view</b>
              <p>
                Only the accepted operator reviewer can issue a signed decision. Project
                participants may inspect the resulting record.
              </p>
            </div>
          </div>
        ) : null}
        <section className="operator-review-grid">
          <div className="workspace-card">
            <div className="panel-heading">
              <div>
                <h2>Evidence presented for review</h2>
                <p>
                  {nodes.length} nodes · {snapshots.length} capacity versions
                </p>
              </div>
              <ShieldCheck />
            </div>
            {nodes.map((node) => (
              <article className="operator-node-card" key={node.id}>
                <h3>{nodeDisplayName(node)}</h3>
                <p>
                  {node.operator_name} · {label(node.source_classification)} ·{" "}
                  {label(node.confidence)}
                </p>
                {snapshots
                  .filter((snapshot) => snapshot.node_id === node.id)
                  .map((snapshot) => (
                    <div className="operator-snapshot" key={snapshot.id}>
                      <b>
                        v{snapshot.version} · {capacityTruth(snapshot).label}
                      </b>
                      <span>Firm import {snapshot.firm_import_mw ?? "unknown"} MW</span>
                      <span>
                        Conditional import {snapshot.conditional_import_mw ?? "unknown"} MW
                      </span>
                    </div>
                  ))}
              </article>
            ))}
            {!nodes.length && (
              <div className="compact-empty">
                The project team has not presented a network node.
              </div>
            )}
          </div>
          {isOperator ? (
            <form className="workspace-card activation-form" onSubmit={uploadEvidence}>
              <div className="panel-heading">
                <div>
                  <h2>Upload operator evidence</h2>
                  <p>Required before confirming any capacity statement.</p>
                </div>
                <Upload />
              </div>
              <label>
                Document type
                <select name="document_type">
                  <option value="capacity_statement">Capacity statement</option>
                  <option value="technical_study">Technical study</option>
                  <option value="connection_offer">Connection offer</option>
                  <option value="operator_response">Operator response</option>
                </select>
              </label>
              <label>
                File
                <input name="file" type="file" required accept=".pdf,.doc,.docx,.xlsx,.csv" />
              </label>
              <label>
                Context
                <textarea name="notes" />
              </label>
              <button className="primary-button" disabled={busy}>
                {busy ? <LoaderCircle className="spin" /> : <Upload />} Upload evidence
              </button>
            </form>
          ) : null}
        </section>
        {isOperator ? (
          <form
            className="workspace-card activation-form operator-decision-form"
            onSubmit={signDecision}
          >
            <div className="panel-heading">
              <div>
                <h2>Issue signed decision</h2>
                <p>
                  Confirmation creates a new operator-confirmed capacity version. Rejection and
                  change requests preserve the candidate evidence unchanged.
                </p>
              </div>
              <FileText />
            </div>
            <div className="form-grid two-columns">
              <label>
                Node
                <select name="node_id" required>
                  {nodes.map((node) => (
                    <option value={node.id} key={node.id}>
                      {nodeDisplayName(node)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Candidate snapshot
                <select name="snapshot_id">
                  <option value="">None</option>
                  {snapshots
                    .filter((snapshot) => snapshot.status !== "operator_confirmed")
                    .map((snapshot) => (
                      <option value={snapshot.id} key={snapshot.id}>
                        v{snapshot.version} ·{" "}
                        {nodes.find((node) => node.id === snapshot.node_id)?.node_name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="form-grid two-columns">
              <label>
                Decision
                <select name="decision">
                  <option value="changes_requested">Request changes</option>
                  <option value="rejected">Reject</option>
                  <option value="confirmed">Confirm presented capacity</option>
                </select>
              </label>
              <label>
                Statement scope
                <select name="statement_scope">
                  <option value="planning_statement">Planning statement</option>
                  <option value="capacity_statement">Capacity statement</option>
                  <option value="contractual_commitment">Contractual commitment</option>
                </select>
              </label>
            </div>
            <label>
              Supporting operator document
              <select name="document_id">
                <option value="">No document</option>
                {operatorDocuments.map((document) => (
                  <option value={document.id} key={document.id}>
                    {document.file_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decision note
              <textarea name="note" required rows={4} />
            </label>
            <label>
              Requested changes, one per line
              <textarea name="requested_changes" rows={3} />
            </label>
            <details>
              <summary>Correct node metadata</summary>
              <div className="form-grid two-columns">
                <label>
                  Node name
                  <input name="node_name" />
                </label>
                <label>
                  Node code
                  <input name="node_code" />
                </label>
                <label>
                  Operator name
                  <input name="operator_name" />
                </label>
                <label>
                  Voltage (kV)
                  <input name="voltage_kv" type="number" min="0.1" step="0.1" />
                </label>
              </div>
            </details>
            <div className="form-grid two-columns">
              <label>
                Valid from
                <input name="valid_from" type="datetime-local" />
              </label>
              <label>
                Valid to
                <input name="valid_to" type="datetime-local" />
              </label>
            </div>
            <label>
              Signer organization
              <input name="organization" required />
            </label>
            <label className="signature-attestation">
              <input type="checkbox" required /> I confirm this decision is issued through my
              authenticated account and accurately reflects the cited organization’s statement.
            </label>
            <button className="primary-button" disabled={busy}>
              <ShieldCheck /> Sign and record decision
            </button>
          </form>
        ) : null}
        <section className="workspace-card">
          <div className="panel-heading">
            <div>
              <h2>Decision history</h2>
              <p>Append-only signed operator record.</p>
            </div>
            <FileText />
          </div>
          {decisions.length ? (
            decisions.map((decision) => (
              <article className="operator-decision-row" key={decision.id}>
                {decision.decision === "confirmed" ? (
                  <CheckCircle />
                ) : decision.decision === "rejected" ? (
                  <XCircle />
                ) : (
                  <AlertTriangle />
                )}
                <div>
                  <b>
                    {label(decision.decision)} · {label(decision.statement_scope)}
                  </b>
                  <p>{decision.note}</p>
                  <small>
                    {decision.signer_name} · {decision.signer_organization} ·{" "}
                    {new Date(decision.signed_at).toLocaleString()}
                  </small>
                  <code>{decision.content_hash.slice(0, 16)}…</code>
                </div>
              </article>
            ))
          ) : (
            <div className="compact-empty">No operator decision recorded.</div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
