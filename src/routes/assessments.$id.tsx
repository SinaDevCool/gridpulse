import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Mail,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  activationDecision,
  constrainedReduction,
  label,
  readiness,
  type AssessmentCollaborator,
  type AssessmentActivity,
  type CandidateSite,
  type AssessmentDocument,
  type AssessmentMilestone,
  type DsoDirectoryEntry,
  type DecisionMemo,
  type Evidence,
  type FcaEnvelope,
  type GridDataSource,
  type IntervalProfile,
  type OperatorCorrespondence,
  type OperatorProfile,
  type OperatorRequirement,
  type Scenario,
} from "@/lib/assessment-model";
import {
  analyseFca,
  parseIntervalCsv,
  summarizeProfile,
  type RestrictionWindow,
} from "@/lib/fca-engine";
import { screenGermanOperator } from "@/lib/german-grid-screening";

export const Route = createFileRoute("/assessments/$id")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AssessmentPage,
});
type Tab =
  | "overview"
  | "documents"
  | "operator"
  | "execution"
  | "profile"
  | "envelopes"
  | "evidence"
  | "scenarios"
  | "activity"
  | "report";

function AssessmentPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["assessment", id, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [
        siteResult,
        evidenceResult,
        scenarioResult,
        profileResult,
        documentResult,
        requirementResult,
        correspondenceResult,
        envelopeResult,
        operatorProfileResult,
        dataSourceResult,
        dsoResult,
        milestoneResult,
        collaboratorResult,
        activityResult,
        memoResult,
      ] = await Promise.all([
        supabase.from("candidate_sites").select("*").eq("id", id).single(),
        supabase
          .from("assessment_evidence")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("connection_scenarios")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("interval_profiles")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("assessment_documents")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("operator_requirements")
          .select("*")
          .eq("site_id", id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("operator_correspondence")
          .select("*")
          .eq("site_id", id)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("fca_envelopes")
          .select("*")
          .eq("site_id", id)
          .order("version", { ascending: false }),
        supabase.from("operator_profiles").select("*").order("operator_name"),
        supabase.from("grid_data_sources").select("*").order("authority"),
        supabase.from("dso_directory").select("*").order("operator_name"),
        supabase.from("assessment_milestones").select("*").eq("site_id", id).order("due_at"),
        supabase.from("assessment_collaborators").select("*").eq("site_id", id).order("created_at"),
        supabase
          .from("assessment_activity")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("decision_memos")
          .select("*")
          .eq("site_id", id)
          .order("version", { ascending: false }),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (evidenceResult.error) throw evidenceResult.error;
      if (scenarioResult.error) throw scenarioResult.error;
      if (profileResult.error) throw profileResult.error;
      if (documentResult.error) throw documentResult.error;
      if (requirementResult.error) throw requirementResult.error;
      if (correspondenceResult.error) throw correspondenceResult.error;
      if (envelopeResult.error) throw envelopeResult.error;
      if (operatorProfileResult.error) throw operatorProfileResult.error;
      if (dataSourceResult.error) throw dataSourceResult.error;
      if (dsoResult.error) throw dsoResult.error;
      if (milestoneResult.error) throw milestoneResult.error;
      if (collaboratorResult.error) throw collaboratorResult.error;
      if (activityResult.error) throw activityResult.error;
      if (memoResult.error) throw memoResult.error;
      return {
        site: siteResult.data as CandidateSite,
        evidence: evidenceResult.data as Evidence[],
        scenarios: scenarioResult.data as Scenario[],
        profiles: profileResult.data as IntervalProfile[],
        documents: documentResult.data as AssessmentDocument[],
        requirements: requirementResult.data as OperatorRequirement[],
        correspondence: correspondenceResult.data as OperatorCorrespondence[],
        envelopes: envelopeResult.data as FcaEnvelope[],
        operatorProfiles: operatorProfileResult.data as OperatorProfile[],
        dataSources: dataSourceResult.data as GridDataSource[],
        dsos: dsoResult.data as DsoDirectoryEntry[],
        milestones: milestoneResult.data as AssessmentMilestone[],
        collaborators: collaboratorResult.data as AssessmentCollaborator[],
        activity: activityResult.data as AssessmentActivity[],
        memos: memoResult.data as DecisionMemo[],
      };
    },
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["assessment", id] });
    await queryClient.invalidateQueries({ queryKey: ["candidate-sites"] });
  }
  if (query.isLoading)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <div className="loading-spinner" />
          <p>Loading assessment…</p>
        </main>
      </AppShell>
    );
  if (query.error || !query.data)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <AlertTriangle />
          <h1>Assessment unavailable</h1>
          <p>
            {query.error instanceof Error
              ? query.error.message
              : "This record does not exist or is not accessible."}
          </p>
          <Link to="/portfolio" className="primary-button">
            Return to portfolio
          </Link>
        </main>
      </AppShell>
    );
  const {
    site,
    evidence,
    scenarios,
    profiles,
    documents,
    requirements,
    correspondence,
    envelopes,
    operatorProfiles,
    dataSources,
    dsos,
    milestones,
    collaborators,
    activity,
    memos,
  } = query.data;
  const ready = readiness(evidence);
  async function archive() {
    setBusy(true);
    const { error } = await supabase
      .from("candidate_sites")
      .update({ assessment_status: "archived" })
      .eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Assessment archived");
      await refresh();
    }
  }
  async function remove() {
    if (!window.confirm("Permanently delete this assessment and all evidence?")) return;
    setBusy(true);
    const { error } = await supabase.from("candidate_sites").delete().eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message);
    else await navigate({ to: "/portfolio" });
  }
  return (
    <AppShell requireAuth>
      <main className="section-page assessment-workspace">
        <Link to="/portfolio" className="back-link">
          <ArrowLeft />
          Portfolio
        </Link>
        <header className="assessment-title">
          <div>
            <p className="context-label">Assessment / {site.id.slice(0, 8)}</p>
            <h1>{site.name}</h1>
            <p>
              {label(site.project_type)} · {site.latitude}, {site.longitude}
            </p>
          </div>
          <div>
            <span className="status warning-text">{label(site.assessment_status)}</span>
            <button onClick={archive} disabled={busy}>
              <Archive />
              Archive
            </button>
            <button className="danger-button" onClick={remove} disabled={busy}>
              <Trash2 />
              Delete
            </button>
          </div>
        </header>
        <div className="readiness-strip">
          <div>
            <span>{ready.completed}/3</span>
            <div>
              <b>Report readiness</b>
              <small>
                {ready.ready ? "Required evidence satisfied" : "Evidence validation incomplete"}
              </small>
            </div>
          </div>
          {[
            [ready.official, "Official source"],
            [ready.customer, "Customer input"],
            [ready.operator, "Operator validation"],
          ].map(([done, text]) => (
            <span className={done ? "ready-item done" : "ready-item"} key={String(text)}>
              {done ? <Check /> : <AlertTriangle />}
              {text}
            </span>
          ))}
        </div>
        <nav className="workspace-tabs">
          {(
            [
              "overview",
              "documents",
              "operator",
              "execution",
              "profile",
              "envelopes",
              "evidence",
              "scenarios",
              "activity",
              "report",
            ] as Tab[]
          ).map((item) => (
            <button
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
              key={item}
            >
              {label(item)}
            </button>
          ))}
        </nav>
        {tab === "overview" ? (
          <Overview
            site={site}
            requirements={requirements}
            documents={documents}
            profiles={profiles}
            envelopes={envelopes}
            busy={busy}
            setBusy={setBusy}
            refresh={refresh}
          />
        ) : tab === "execution" ? (
          <ExecutionRoom
            site={site}
            dsos={dsos}
            milestones={milestones}
            collaborators={collaborators}
            requirements={requirements}
            documents={documents}
            correspondence={correspondence}
            openReport={() => setTab("report")}
            refresh={refresh}
          />
        ) : tab === "documents" ? (
          <DocumentRoom site={site} documents={documents} refresh={refresh} />
        ) : tab === "operator" ? (
          <OperatorRoom
            site={site}
            documents={documents}
            requirements={requirements}
            correspondence={correspondence}
            operatorProfiles={operatorProfiles}
            dataSources={dataSources}
            refresh={refresh}
          />
        ) : tab === "evidence" ? (
          <EvidenceRoom site={site} evidence={evidence} refresh={refresh} />
        ) : tab === "profile" ? (
          <ProfileRoom site={site} profiles={profiles} refresh={refresh} />
        ) : tab === "scenarios" ? (
          <Scenarios site={site} scenarios={scenarios} profiles={profiles} refresh={refresh} />
        ) : tab === "envelopes" ? (
          <EnvelopeRoom site={site} documents={documents} envelopes={envelopes} refresh={refresh} />
        ) : tab === "activity" ? (
          <ActivityRoom activity={activity} memos={memos} />
        ) : (
          <Report
            site={site}
            evidence={evidence}
            scenarios={scenarios}
            profiles={profiles}
            requirements={requirements}
            documents={documents}
            milestones={milestones}
            envelopes={envelopes}
            memos={memos}
            refresh={refresh}
          />
        )}
      </main>
    </AppShell>
  );
}

function ExecutionRoom({
  site,
  dsos,
  milestones,
  collaborators,
  requirements,
  documents,
  correspondence,
  openReport,
  refresh,
}: {
  site: CandidateSite;
  dsos: DsoDirectoryEntry[];
  milestones: AssessmentMilestone[];
  collaborators: AssessmentCollaborator[];
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  correspondence: OperatorCorrespondence[];
  openReport: () => void;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function saveResponsibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const level = String(values.get("operatorLevel"));
    const selectedDso = dsos.find((item) => item.key === String(values.get("dsoKey")));
    const operatorName =
      level === "distribution"
        ? selectedDso?.operator_name
        : (site.likely_network_operator ?? undefined);
    const source = String(values.get("responsibilitySource"));
    const { error } = await supabase
      .from("candidate_sites")
      .update({
        responsible_operator_name: operatorName ?? null,
        responsible_operator_level: level,
        responsibility_source: source,
        responsibility_confirmed_at: source === "operator" ? new Date().toISOString() : null,
      })
      .eq("id", site.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Connection responsibility saved");
    await refresh();
  }
  async function addMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const { error } = await supabase.from("assessment_milestones").insert({
      site_id: site.id,
      user_id: site.user_id,
      title: String(values.get("title")),
      due_at: new Date(String(values.get("dueAt"))).toISOString(),
      milestone_type: String(values.get("milestoneType")),
      reminder_days: Number(values.get("reminderDays")),
      notes: String(values.get("notes") || "") || null,
    });
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Milestone added");
    await refresh();
  }
  async function setMilestoneStatus(milestone: AssessmentMilestone, status: string) {
    const { error } = await supabase
      .from("assessment_milestones")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", milestone.id);
    if (error) return toast.error(error.message);
    await refresh();
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const { error } = await supabase.from("assessment_collaborators").insert({
      site_id: site.id,
      owner_id: site.user_id,
      invited_email: String(values.get("email")).trim().toLowerCase(),
      role: String(values.get("role")),
    });
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Collaborator registered; they can accept after signing in");
    await refresh();
  }
  async function removeCollaborator(id: string) {
    const { error } = await supabase.from("assessment_collaborators").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Collaborator access removed");
    await refresh();
  }
  function exportManifest() {
    const rows = [
      ["record_type", "item", "status", "evidence_or_date", "notes"],
      ...requirements.map((item) => [
        "requirement",
        item.label,
        item.status,
        documents.find((document) => document.id === item.document_id)?.file_name ?? "",
        item.notes ?? "",
      ]),
      ...documents.map((item) => [
        "document",
        item.file_name,
        item.review_status,
        item.source_classification,
        item.notes ?? "",
      ]),
      ...correspondence.map((item) => [
        "correspondence",
        item.subject,
        item.direction,
        item.occurred_at,
        item.summary,
      ]),
    ];
    downloadText(
      `${site.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-application-manifest.csv`,
      rows.map((row) => row.map(csvCell).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  const now = Date.now();
  return (
    <div className="activation-stack execution-room">
      <div className="activation-layout">
        <form className="workspace-card activation-form" onSubmit={saveResponsibility}>
          <div className="panel-heading">
            <div>
              <h2>Connection responsibility</h2>
              <p>Use directory coverage for routing, then record the confirmation source.</p>
            </div>
            <Zap />
          </div>
          <label>
            Connection level
            <select
              name="operatorLevel"
              defaultValue={site.responsible_operator_level ?? "distribution"}
            >
              <option value="distribution">Distribution operator</option>
              <option value="transmission">Transmission operator</option>
            </select>
          </label>
          <label>
            Candidate DSO
            <select name="dsoKey" defaultValue="">
              <option value="">Select from major German DSOs</option>
              {dsos.map((dso) => (
                <option value={dso.key} key={dso.key}>
                  {dso.operator_name} — {dso.coverage_summary}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsibility evidence
            <select
              name="responsibilitySource"
              defaultValue={site.responsibility_source ?? "screening"}
            >
              <option value="screening">Screening only</option>
              <option value="customer">Customer confirmed</option>
              <option value="operator">Operator confirmed</option>
            </select>
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : <Save />} Save responsibility
          </button>
          <div className="source-warning">
            <AlertTriangle /> Directory coverage never proves capacity or parcel responsibility.
          </div>
        </form>
        <section className="workspace-card activation-list">
          <div className="panel-heading">
            <div>
              <h2>Application package</h2>
              <p>Export a traceable manifest for operator or adviser review.</p>
            </div>
            <Download />
          </div>
          <dl className="detail-list">
            <dt>Requirements</dt>
            <dd>{requirements.length}</dd>
            <dt>Documents</dt>
            <dd>{documents.length}</dd>
            <dt>Interactions</dt>
            <dd>{correspondence.length}</dd>
            <dt>Responsible operator</dt>
            <dd>{site.responsible_operator_name ?? "Unconfirmed"}</dd>
          </dl>
          <button className="primary-button" onClick={exportManifest}>
            <Download /> Download manifest CSV
          </button>
          <button onClick={openReport}>
            <FileText /> Open decision memo
          </button>
        </section>
      </div>
      <div className="activation-layout">
        <form className="workspace-card activation-form" onSubmit={addMilestone}>
          <div className="panel-heading">
            <div>
              <h2>Add deadline</h2>
              <p>Track submissions, meetings and energization gates.</p>
            </div>
            <CalendarClock />
          </div>
          <label>
            Milestone
            <input name="title" required />
          </label>
          <div className="form-grid two-columns">
            <label>
              Type
              <select name="milestoneType">
                <option value="operator_deadline">Operator deadline</option>
                <option value="submission">Submission</option>
                <option value="meeting">Meeting</option>
                <option value="internal">Internal</option>
                <option value="energization">Energization</option>
              </select>
            </label>
            <label>
              Due at
              <input name="dueAt" type="datetime-local" required />
            </label>
          </div>
          <label>
            Reminder lead time
            <select name="reminderDays" defaultValue="7">
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <button className="primary-button">
            <Plus /> Add milestone
          </button>
        </form>
        <section className="workspace-card activation-list">
          <div className="panel-heading">
            <div>
              <h2>Deadline register</h2>
              <p>{milestones.filter((item) => item.status === "open").length} open milestones.</p>
            </div>
            <CalendarClock />
          </div>
          {milestones.length === 0 ? (
            <div className="compact-empty">No milestones recorded.</div>
          ) : (
            milestones.map((item) => {
              const days = Math.ceil((new Date(item.due_at).getTime() - now) / 86400000);
              return (
                <article
                  className={
                    days < 0 && item.status === "open" ? "timeline-row overdue" : "timeline-row"
                  }
                  key={item.id}
                >
                  <span>{item.status === "done" ? "Done" : days < 0 ? "Overdue" : `${days}d`}</span>
                  <div>
                    <b>{item.title}</b>
                    <small>
                      {new Date(item.due_at).toLocaleString()} · {label(item.milestone_type)}
                    </small>
                    <p>{item.notes}</p>
                  </div>
                  <button
                    onClick={() =>
                      void setMilestoneStatus(item, item.status === "done" ? "open" : "done")
                    }
                  >
                    {item.status === "done" ? "Reopen" : "Complete"}
                  </button>
                </article>
              );
            })
          )}
        </section>
      </div>
      <section className="workspace-card collaborator-card">
        <div className="panel-heading">
          <div>
            <h2>Project collaborators</h2>
            <p>Viewers have read-only access; editors can update the workspace after accepting.</p>
          </div>
          <Users />
        </div>
        <form className="collaborator-form" onSubmit={invite}>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Role
            <select name="role">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </label>
          <button className="primary-button">
            <Plus /> Add collaborator
          </button>
        </form>
        <div className="collaborator-list">
          {collaborators.map((item) => (
            <div key={item.id}>
              <b>{item.invited_email}</b>
              <span>
                {label(item.role)} · {item.accepted_at ? "Accepted" : "Pending"}
              </span>
              <button
                className="icon-button danger-button"
                onClick={() => void removeCollaborator(item.id)}
                aria-label={`Remove ${item.invited_email}`}
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function DocumentRoom({
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

function OperatorRoom({
  site,
  documents,
  requirements,
  correspondence,
  operatorProfiles,
  dataSources,
  refresh,
}: {
  site: CandidateSite;
  documents: AssessmentDocument[];
  requirements: OperatorRequirement[];
  correspondence: OperatorCorrespondence[];
  operatorProfiles: OperatorProfile[];
  dataSources: GridDataSource[];
  refresh: () => Promise<void>;
}) {
  const [profileBusy, setProfileBusy] = useState(false);
  async function applyProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    const values = new FormData(event.currentTarget);
    const profileKey = String(values.get("profileKey"));
    const { error } = await supabase.rpc("apply_operator_profile", {
      p_site_id: site.id,
      p_profile_key: profileKey,
    });
    setProfileBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Operator procedure applied");
    await refresh();
  }
  async function updateRequirement(requirement: OperatorRequirement, values: FormData) {
    const { error } = await supabase
      .from("operator_requirements")
      .update({
        status: String(values.get("status")),
        document_id: String(values.get("documentId") || "") || null,
        notes: String(values.get("notes") || "") || null,
      })
      .eq("id", requirement.id);
    if (error) return toast.error(error.message);
    toast.success("Requirement updated");
    await refresh();
  }
  async function addCorrespondence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const occurred = String(values.get("occurredAt"));
    const { error } = await supabase.from("operator_correspondence").insert({
      site_id: site.id,
      user_id: site.user_id,
      direction: String(values.get("direction")),
      contact_name: String(values.get("contactName") || "") || null,
      subject: String(values.get("subject")),
      occurred_at: new Date(occurred).toISOString(),
      summary: String(values.get("summary")),
      document_id: String(values.get("documentId") || "") || null,
    });
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Operator interaction logged");
    await refresh();
  }
  const readyCount = requirements.filter((item) =>
    ["ready", "submitted", "accepted", "not_applicable"].includes(item.status),
  ).length;
  return (
    <div className="activation-stack">
      <section className="workspace-card operator-routing-card">
        <div className="panel-heading">
          <div>
            <h2>German operator routing</h2>
            <p>
              Apply the 2026 four-TSO maturity procedure, then confirm whether the case belongs at
              transmission or distribution level.
            </p>
          </div>
          <Zap />
        </div>
        <form className="operator-routing-form" onSubmit={applyProfile}>
          <label>
            Transmission-area profile
            <select name="profileKey" defaultValue={site.operator_profile_key ?? ""} required>
              <option value="" disabled>
                Select likely TSO area
              </option>
              {operatorProfiles.map((profile) => (
                <option key={profile.key} value={profile.key}>
                  {profile.operator_name} — {profile.region_label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={profileBusy}>
            {profileBusy ? <LoaderCircle className="spin" /> : <ClipboardCheck />}
            Apply procedure
          </button>
        </form>
        <div className="source-warning">
          <AlertTriangle />
          <span>
            This routes the evidence workflow only. It does not confirm the responsible DSO,
            connection point, or available capacity.
          </span>
        </div>
      </section>
      <section className="workspace-card">
        <div className="panel-heading">
          <div>
            <h2>Operator application checklist</h2>
            <p>
              {readyCount}/{requirements.length} requirements ready · likely operator:{" "}
              {site.likely_network_operator ?? "not confirmed"}
            </p>
          </div>
          <ClipboardCheck />
        </div>
        <div className="requirement-grid">
          {requirements.map((requirement) => (
            <form
              className="requirement-card"
              key={requirement.id}
              onSubmit={(event) => {
                event.preventDefault();
                void updateRequirement(requirement, new FormData(event.currentTarget));
              }}
            >
              <div>
                <span>{label(requirement.category)}</span>
                <h3>{requirement.label}</h3>
                {requirement.source_url ? (
                  <a href={requirement.source_url} target="_blank" rel="noreferrer">
                    Operator source <ExternalLink />
                  </a>
                ) : null}
              </div>
              <select
                name="status"
                defaultValue={requirement.status}
                aria-label="Requirement status"
              >
                <option value="missing">Missing</option>
                <option value="in_progress">In progress</option>
                <option value="ready">Ready</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="not_applicable">Not applicable</option>
              </select>
              <select
                name="documentId"
                defaultValue={requirement.document_id ?? ""}
                aria-label="Linked document"
              >
                <option value="">No linked document</option>
                {documents.map((document) => (
                  <option value={document.id} key={document.id}>
                    {document.file_name}
                  </option>
                ))}
              </select>
              <input
                name="notes"
                defaultValue={requirement.notes ?? ""}
                placeholder="Requirement notes"
              />
              <button type="submit">
                <Save /> Save
              </button>
            </form>
          ))}
        </div>
      </section>
      <div className="activation-layout">
        <form className="workspace-card activation-form" onSubmit={addCorrespondence}>
          <div className="panel-heading">
            <div>
              <h2>Log operator interaction</h2>
              <p>Retain the decision and correspondence history.</p>
            </div>
            <Mail />
          </div>
          <div className="form-grid two-columns">
            <label>
              Type
              <select name="direction" defaultValue="outbound">
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
                <option value="meeting">Meeting</option>
                <option value="internal_note">Internal note</option>
              </select>
            </label>
            <label>
              Date and time
              <input name="occurredAt" type="datetime-local" required />
            </label>
          </div>
          <label>
            Contact
            <input name="contactName" placeholder="Operator contact or team" />
          </label>
          <label>
            Subject
            <input name="subject" required />
          </label>
          <label>
            Summary
            <textarea name="summary" rows={4} required />
          </label>
          <label>
            Attachment
            <select name="documentId" defaultValue="">
              <option value="">No attachment</option>
              {documents.map((document) => (
                <option value={document.id} key={document.id}>
                  {document.file_name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            <Plus /> Add interaction
          </button>
        </form>
        <section className="workspace-card activation-list">
          <div className="panel-heading">
            <div>
              <h2>Correspondence timeline</h2>
              <p>{correspondence.length} recorded interactions.</p>
            </div>
            <Mail />
          </div>
          {correspondence.length === 0 ? (
            <div className="compact-empty">No operator interactions recorded.</div>
          ) : (
            correspondence.map((item) => (
              <article className="timeline-row" key={item.id}>
                <span>{label(item.direction)}</span>
                <div>
                  <b>{item.subject}</b>
                  <small>
                    {new Date(item.occurred_at).toLocaleString()} ·{" "}
                    {item.contact_name ?? "No contact recorded"}
                  </small>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
      <section className="workspace-card data-source-register">
        <div className="panel-heading">
          <div>
            <h2>Official-data register</h2>
            <p>Sources support context and evidence collection; limitations stay visible.</p>
          </div>
          <FileText />
        </div>
        <div className="data-source-grid">
          {dataSources.map((source) => (
            <article key={source.key}>
              <span>{source.authority}</span>
              <h3>{source.title}</h3>
              <p>{source.use_in_gridpulse}</p>
              <small>{source.limitation}</small>
              <a href={source.source_url} target="_blank" rel="noreferrer">
                Open source <ExternalLink />
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EnvelopeRoom({
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

function Overview({
  site,
  requirements,
  documents,
  profiles,
  envelopes,
  busy,
  setBusy,
  refresh,
}: {
  site: CandidateSite;
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  profiles: IntervalProfile[];
  envelopes: FcaEnvelope[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const screening = screenGermanOperator(site.latitude, site.longitude);
  const decision = activationDecision({ site, requirements, documents, profiles, envelopes });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const f = new FormData(event.currentTarget);
    const { error } = await supabase
      .from("candidate_sites")
      .update({
        name: String(f.get("name")),
        requested_import_mw: Number(f.get("importMw")),
        requested_export_mw: Number(f.get("exportMw")),
        target_voltage_kv: Number(f.get("voltageKv")) || null,
        likely_network_operator: String(f.get("operator") || "") || null,
        operator_status: String(f.get("operatorStatus")),
        operator_confirmation_status: String(f.get("operatorConfirmationStatus")),
        target_energization_date: String(f.get("targetEnergizationDate") || "") || null,
        decision_status: String(f.get("decisionStatus")),
        decision_notes: String(f.get("decisionNotes") || "") || null,
      })
      .eq("id", site.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Project details saved");
      await refresh();
    }
  }
  return (
    <div className="activation-stack">
      <section className="workspace-card decision-summary">
        <div className="decision-score">
          <span>Activation readiness</span>
          <b>{decision.score}</b>
          <small>/ 100 evidence-weighted</small>
        </div>
        <div>
          <span className="context-label">Recommended next action</span>
          <h2>{decision.nextAction}</h2>
          <p>
            This score measures decision readiness, not grid headroom. Capacity remains unknown
            until the responsible operator provides evidence.
          </p>
        </div>
        <div className="decision-blockers">
          <span>{decision.blockers.length} open gates</span>
          {decision.blockers.slice(0, 3).map((blocker) => (
            <small key={blocker}>
              <AlertTriangle /> {blocker}
            </small>
          ))}
        </div>
      </section>
      <div className="workspace-columns">
        <form className="product-form" onSubmit={save}>
          <div className="form-section">
            <h2>Project and connection requirement</h2>
            <p>Customer inputs remain distinct from operator-confirmed information.</p>
            <label>
              Project name
              <input name="name" defaultValue={site.name} required />
            </label>
            <div className="form-grid">
              <label>
                Requested import (MW)
                <input
                  name="importMw"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={site.requested_import_mw}
                />
              </label>
              <label>
                Requested export (MW)
                <input
                  name="exportMw"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={site.requested_export_mw}
                />
              </label>
            </div>
            <label>
              Target voltage (kV)
              <input
                name="voltageKv"
                type="number"
                min="0"
                step="0.001"
                defaultValue={site.target_voltage_kv ?? ""}
              />
            </label>
          </div>
          <div className="form-section">
            <h2>Network operator screening</h2>
            <label>
              Likely network operator
              <input
                name="operator"
                defaultValue={site.likely_network_operator ?? screening.transmissionOperator}
                placeholder="Enter screening result"
              />
              <small className="field-help">
                Suggested transmission-area context: {screening.transmissionOperator}. Screening
                only; confirm the responsible DSO and connection point.
              </small>
            </label>
            <label>
              Confirmation status
              <select
                name="operatorConfirmationStatus"
                defaultValue={site.operator_confirmation_status}
              >
                <option value="screening_only">Screening only</option>
                <option value="customer_confirmed">Customer confirmed</option>
                <option value="operator_confirmed">Operator confirmed</option>
              </select>
            </label>
            <input name="operatorStatus" type="hidden" value={site.operator_status} />
          </div>
          <div className="form-section">
            <h2>Activation decision</h2>
            <div className="form-grid two-columns">
              <label>
                Workflow decision
                <select name="decisionStatus" defaultValue={site.decision_status}>
                  <option value="collect_evidence">Collect evidence</option>
                  <option value="prepare_application">Prepare application</option>
                  <option value="submit_application">Submit application</option>
                  <option value="operator_review">Operator review</option>
                  <option value="envelope_agreed">Envelope agreed</option>
                  <option value="hold">Hold</option>
                </select>
              </label>
              <label>
                Target energization
                <input
                  name="targetEnergizationDate"
                  type="date"
                  defaultValue={site.target_energization_date ?? ""}
                />
              </label>
            </div>
            <label>
              Decision notes
              <textarea name="decisionNotes" rows={3} defaultValue={site.decision_notes ?? ""} />
            </label>
            <label>
              Legacy operator stage
              <select name="operatorStatusDisplay" defaultValue={site.operator_status} disabled>
                <option value="screening">Screening only</option>
                <option value="customer_confirmed">Customer confirmed</option>
                <option value="operator_confirmed">Operator confirmed</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <span>Updated {new Date(site.updated_at).toLocaleDateString()}</span>
            <button className="primary-button" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Save />}Save changes
            </button>
          </div>
        </form>
        <aside className="guidance-card">
          <h2>Declared project envelope</h2>
          <dl className="detail-list">
            <dt>Country</dt>
            <dd>{site.country_code}</dd>
            <dt>Coordinates</dt>
            <dd>
              {site.latitude}, {site.longitude}
            </dd>
            <dt>Project type</dt>
            <dd>{label(site.project_type)}</dd>
            <dt>Operator status</dt>
            <dd>{label(site.operator_status)}</dd>
            <dt>Regional context</dt>
            <dd>{screening.regionalContext}</dd>
          </dl>
          <a href={screening.sourceUrl} target="_blank" rel="noreferrer">
            Review German transmission planning source <ExternalLink />
          </a>
        </aside>
      </div>
    </div>
  );
}

function ProfileRoom({
  site,
  profiles,
  refresh,
}: {
  site: CandidateSite;
  profiles: IntervalProfile[];
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof summarizeProfile> | null>(null);
  const [points, setPoints] = useState<ReturnType<typeof parseIntervalCsv>>([]);
  const [filename, setFilename] = useState("");
  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseIntervalCsv(await file.text());
      setPoints(parsed);
      setPreview(summarizeProfile(parsed));
      setFilename(file.name);
    } catch (error) {
      setPoints([]);
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Unable to parse profile");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || points.length === 0) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("interval_profiles").insert({
      site_id: site.id,
      user_id: site.user_id,
      name: String(form.get("name")),
      source_filename: filename,
      interval_minutes: preview.intervalMinutes,
      period_start: preview.periodStart,
      period_end: preview.periodEnd,
      interval_count: preview.intervalCount,
      peak_import_mw: preview.peakImportMw,
      peak_export_mw: preview.peakExportMw,
      points,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Operating profile saved");
      setPoints([]);
      setPreview(null);
      setFilename("");
      await refresh();
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("interval_profiles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  return (
    <div className="workspace-columns">
      <form className="product-form" onSubmit={save}>
        <div className="form-section">
          <h2>Upload operating profile</h2>
          <p>Use 15, 30, or 60-minute intervals. Times are normalized to UTC for calculation.</p>
          <label>
            Profile name
            <input name="name" required placeholder="2027 reference dispatch" />
          </label>
          <label className="file-drop">
            <Upload />
            <b>{filename || "Choose interval CSV"}</b>
            <span>Columns: timestamp, import_mw, export_mw</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
          </label>
          <a className="template-link" href="/example-operating-profile.csv" download>
            Download CSV template
          </a>
          {preview ? (
            <dl className="profile-preview detail-list">
              <dt>Intervals</dt>
              <dd>{preview.intervalCount.toLocaleString()}</dd>
              <dt>Resolution</dt>
              <dd>{preview.intervalMinutes} minutes</dd>
              <dt>Peak import</dt>
              <dd>{preview.peakImportMw} MW</dd>
              <dt>Peak export</dt>
              <dd>{preview.peakExportMw} MW</dd>
            </dl>
          ) : null}
        </div>
        <div className="form-actions">
          <span>Operational data remains private to your account.</span>
          <button className="primary-button" disabled={busy || !preview}>
            {busy ? <LoaderCircle className="spin" /> : <Upload />} Save profile
          </button>
        </div>
      </form>
      <div className="scenario-list">
        {profiles.length === 0 ? (
          <div className="portfolio-state">
            <Upload />
            <h2>No profile uploaded</h2>
            <p>Add a profile to calculate energy and commercial impacts.</p>
          </div>
        ) : (
          profiles.map((profile) => (
            <article className="scenario-card" key={profile.id}>
              <div>
                <span className="evidence evidence-input">Operating profile</span>
                <button
                  className="icon-button danger-button"
                  onClick={() => void remove(profile.id)}
                >
                  <Trash2 />
                </button>
              </div>
              <h2>{profile.name}</h2>
              <dl className="detail-list">
                <dt>Resolution</dt>
                <dd>{profile.interval_minutes} minutes</dd>
                <dt>Coverage</dt>
                <dd>
                  {new Date(profile.period_start).toLocaleDateString()} –{" "}
                  {new Date(profile.period_end).toLocaleDateString()}
                </dd>
                <dt>Intervals</dt>
                <dd>{profile.interval_count.toLocaleString()}</dd>
                <dt>Peak import / export</dt>
                <dd>
                  {profile.peak_import_mw} / {profile.peak_export_mw} MW
                </dd>
              </dl>
              <small>{profile.source_filename}</small>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function EvidenceRoom({
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

function Scenarios({
  site,
  scenarios,
  profiles,
  refresh,
}: {
  site: CandidateSite;
  scenarios: Scenario[];
  profiles: IntervalProfile[];
  refresh: () => Promise<void>;
}) {
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const mode = String(f.get("mode"));
    const profile = profiles.find((item) => item.id === String(f.get("profileId")));
    const importLimit = f.get("importLimit") === "" ? null : Number(f.get("importLimit"));
    const exportLimit = f.get("exportLimit") === "" ? null : Number(f.get("exportLimit"));
    const energyValue = Number(f.get("energyValue") || 0);
    const restrictionWindow: RestrictionWindow | null =
      mode === "dynamic_fca"
        ? {
            startHour: Number(f.get("startHour") || 0),
            endHour: Number(f.get("endHour") || 24),
            weekdays: [1, 2, 3, 4, 5],
            importLimitMw: importLimit,
            exportLimitMw: exportLimit,
          }
        : null;
    const analysis = profile
      ? analyseFca(profile.points, mode, importLimit, exportLimit, restrictionWindow, energyValue)
      : null;
    const { error } = await supabase.from("connection_scenarios").insert({
      site_id: site.id,
      user_id: site.user_id,
      name: String(f.get("name")),
      connection_mode: mode,
      max_import_mw: importLimit,
      max_export_mw: exportLimit,
      restriction_schedule: restrictionWindow,
      profile_id: profile?.id ?? null,
      energy_value_eur_mwh: energyValue,
      analysis,
      calculation_version: analysis?.calculationVersion ?? "screening-v1",
      status: analysis ? "calculated" : "evidence_incomplete",
      assumptions: ["Limits are user-entered and require operator evidence"],
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Scenario added");
      form.reset();
      await refresh();
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("connection_scenarios").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  return (
    <div className="workspace-columns">
      <form className="product-form" onSubmit={add}>
        <div className="form-section">
          <h2>Add connection scenario</h2>
          <p>Only enter restrictions supported by an offer, study, or explicit assumption.</p>
          <label>
            Scenario name
            <input name="name" required placeholder="Static FCA draft" />
          </label>
          <label>
            Connection mode
            <select name="mode">
              <option value="unrestricted">Unrestricted baseline</option>
              <option value="static_fca">Static FCA</option>
              <option value="dynamic_fca">Dynamic FCA</option>
            </select>
          </label>
          <label>
            Operating profile
            <select name="profileId" defaultValue="">
              <option value="">No profile — MW screening only</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Maximum import (MW)
              <input name="importLimit" type="number" min="0" step="0.001" />
            </label>
            <label>
              Maximum export (MW)
              <input name="exportLimit" type="number" min="0" step="0.001" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Restriction start hour (UTC)
              <input name="startHour" type="number" min="0" max="23" defaultValue="8" />
            </label>
            <label>
              Restriction end hour (UTC)
              <input name="endHour" type="number" min="1" max="24" defaultValue="20" />
            </label>
          </div>
          <label>
            Indicative energy value (EUR/MWh)
            <input name="energyValue" type="number" min="0" step="0.01" defaultValue="0" />
            <small className="field-help">Commercial assumption, not a revenue forecast.</small>
          </label>
        </div>
        <div className="form-actions">
          <span>Calculated reductions are arithmetic, not grid studies.</span>
          <button className="primary-button">
            <Plus />
            Add scenario
          </button>
        </div>
      </form>
      <div className="scenario-list">
        {scenarios.length === 0 ? (
          <div className="portfolio-state">
            <h2>No scenarios yet</h2>
            <p>Add an unrestricted baseline or an evidence-supported FCA case.</p>
          </div>
        ) : (
          scenarios.map((s) => {
            const importReduction = constrainedReduction(site.requested_import_mw, s.max_import_mw);
            const exportReduction = constrainedReduction(site.requested_export_mw, s.max_export_mw);
            return (
              <article className="scenario-card" key={s.id}>
                <div>
                  <span className="evidence evidence-calculation">{label(s.connection_mode)}</span>
                  <button className="icon-button danger-button" onClick={() => void remove(s.id)}>
                    <Trash2 />
                  </button>
                </div>
                <h2>{s.name}</h2>
                <dl className="detail-list">
                  <dt>Import limit</dt>
                  <dd>
                    {s.max_import_mw ?? "Unknown"} {s.max_import_mw != null ? "MW" : ""}
                  </dd>
                  <dt>Import reduction</dt>
                  <dd>{importReduction == null ? "Not calculated" : `${importReduction} MW`}</dd>
                  <dt>Export limit</dt>
                  <dd>
                    {s.max_export_mw ?? "Unknown"} {s.max_export_mw != null ? "MW" : ""}
                  </dd>
                  <dt>Export reduction</dt>
                  <dd>{exportReduction == null ? "Not calculated" : `${exportReduction} MW`}</dd>
                  <dt>Evidence status</dt>
                  <dd>{label(s.status)}</dd>
                  {s.analysis ? (
                    <>
                      <dt>Restricted hours</dt>
                      <dd>{s.analysis.restrictedHours.toLocaleString()} h</dd>
                      <dt>Constrained import</dt>
                      <dd>{s.analysis.constrainedImportMwh.toLocaleString()} MWh</dd>
                      <dt>Constrained export</dt>
                      <dd>{s.analysis.constrainedExportMwh.toLocaleString()} MWh</dd>
                      <dt>Indicative gross impact</dt>
                      <dd>€{s.analysis.estimatedGrossImpactEur.toLocaleString()}</dd>
                    </>
                  ) : null}
                </dl>
                <small>Calculation version: {s.calculation_version}</small>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function Report({
  site,
  evidence,
  scenarios,
  profiles,
  requirements,
  documents,
  milestones,
  envelopes,
  memos,
  refresh,
}: {
  site: CandidateSite;
  evidence: Evidence[];
  scenarios: Scenario[];
  profiles: IntervalProfile[];
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  milestones: AssessmentMilestone[];
  envelopes: FcaEnvelope[];
  memos: DecisionMemo[];
  refresh: () => Promise<void>;
}) {
  const state = readiness(evidence);
  const decision = activationDecision({ site, requirements, documents, profiles, envelopes });
  const [saving, setSaving] = useState(false);
  async function saveSnapshot() {
    setSaving(true);
    const { error } = await supabase.from("decision_memos").insert({
      site_id: site.id,
      user_id: site.user_id,
      version: 0,
      readiness_score: decision.score,
      workflow_status: site.decision_status,
      recommended_next_action: decision.nextAction,
      blockers: decision.blockers,
      snapshot: {
        project: {
          name: site.name,
          projectType: site.project_type,
          requestedImportMw: site.requested_import_mw,
          requestedExportMw: site.requested_export_mw,
          targetVoltageKv: site.target_voltage_kv,
        },
        counts: {
          evidence: evidence.length,
          requirements: requirements.length,
          documents: documents.length,
          scenarios: scenarios.length,
          milestones: milestones.length,
        },
        generatedAt: new Date().toISOString(),
        limitation:
          "Not a grid connection offer, network study, capacity reservation, or revenue forecast.",
      },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Decision memo snapshot saved");
    await refresh();
  }
  return (
    <article className="print-report">
      <header>
        <div>
          <p className="context-label">GridPulse pre-feasibility report</p>
          <h1>{site.name}</h1>
          <p>Generated {new Date().toLocaleDateString()} · Preliminary decision support</p>
        </div>
        <div className="report-actions no-print">
          <span>
            {memos.length ? `Latest saved version: ${memos[0].version}` : "No saved version"}
          </span>
          <button onClick={() => void saveSnapshot()} disabled={saving}>
            {saving ? <LoaderCircle className="spin" /> : <Save />} Save snapshot
          </button>
          <button className="primary-button" onClick={() => window.print()}>
            <FileText /> Print / save PDF
          </button>
        </div>
      </header>
      {!state.ready ? (
        <div className="report-blocker">
          <AlertTriangle />
          <div>
            <b>Report generation is locked</b>
            <p>
              Add a collected official source, a collected customer input, and validated operator
              evidence.
            </p>
          </div>
        </div>
      ) : null}
      <section>
        <h2>Executive decision</h2>
        <dl className="report-details">
          <dt>Activation readiness</dt>
          <dd>{decision.score}/100</dd>
          <dt>Recommended next action</dt>
          <dd>{decision.nextAction}</dd>
          <dt>Workflow status</dt>
          <dd>{label(site.decision_status)}</dd>
          <dt>Target energization</dt>
          <dd>{site.target_energization_date ?? "Not scheduled"}</dd>
        </dl>
        {decision.blockers.map((blocker) => (
          <div className="report-row" key={blocker}>
            <b>Open gate</b>
            <span>{blocker}</span>
          </div>
        ))}
      </section>
      <section>
        <h2>Project requirement</h2>
        <dl className="report-details">
          <dt>Project type</dt>
          <dd>{label(site.project_type)}</dd>
          <dt>Location</dt>
          <dd>
            {site.latitude}, {site.longitude}
          </dd>
          <dt>Requested import</dt>
          <dd>{site.requested_import_mw} MW</dd>
          <dt>Requested export</dt>
          <dd>{site.requested_export_mw} MW</dd>
          <dt>Target voltage</dt>
          <dd>{site.target_voltage_kv ?? "Not supplied"} kV</dd>
          <dt>Network operator</dt>
          <dd>
            {site.responsible_operator_name ?? site.likely_network_operator ?? "Not confirmed"} (
            {label(site.responsibility_source ?? site.operator_status)})
          </dd>
        </dl>
      </section>
      <section>
        <h2>Operator application readiness</h2>
        {requirements.map((item) => (
          <div className="report-row" key={item.id}>
            <b>{item.label}</b>
            <span>
              {label(item.status)} ·{" "}
              {documents.find((document) => document.id === item.document_id)?.file_name ??
                "No linked document"}
            </span>
          </div>
        ))}
      </section>
      <section>
        <h2>Evidence ledger</h2>
        <p>
          {evidence.length} items recorded. Each retains its classification and validation status.
        </p>
        {evidence.map((item) => (
          <div className="report-row" key={item.id}>
            <b>{item.title}</b>
            <span>
              {label(item.classification)} · {label(item.validation_status)}
            </span>
          </div>
        ))}
      </section>
      <section>
        <h2>Operating profile</h2>
        {profiles.length === 0 ? (
          <p>No interval profile supplied.</p>
        ) : (
          profiles.map((profile) => (
            <div className="report-row" key={profile.id}>
              <b>{profile.name}</b>
              <span>
                {profile.interval_count.toLocaleString()} × {profile.interval_minutes}-minute
                intervals · peak {profile.peak_import_mw} MW import / {profile.peak_export_mw} MW
                export
              </span>
            </div>
          ))
        )}
      </section>
      <section>
        <h2>Connection scenarios</h2>
        {scenarios.length === 0 ? (
          <p>No restriction scenarios supplied.</p>
        ) : (
          scenarios.map((s) => (
            <div className="report-row" key={s.id}>
              <b>{s.name}</b>
              <span>
                {label(s.connection_mode)} · Import {s.max_import_mw ?? "unknown"} MW · Export{" "}
                {s.max_export_mw ?? "unknown"} MW
                {s.analysis
                  ? ` · ${s.analysis.constrainedImportMwh + s.analysis.constrainedExportMwh} MWh constrained · €${s.analysis.estimatedGrossImpactEur.toLocaleString()} indicative impact`
                  : ""}
              </span>
            </div>
          ))
        )}
      </section>
      <section>
        <h2>Delivery milestones</h2>
        {milestones.length === 0 ? (
          <p>No deadlines recorded.</p>
        ) : (
          milestones.map((item) => (
            <div className="report-row" key={item.id}>
              <b>{item.title}</b>
              <span>
                {label(item.status)} · due {new Date(item.due_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </section>
      <footer>
        <b>Limitations</b>
        <p>
          This report is not a grid connection offer, network study, capacity reservation, or
          revenue forecast. Operator validation remains controlling.
        </p>
      </footer>
    </article>
  );
}

function ActivityRoom({
  activity,
  memos,
}: {
  activity: AssessmentActivity[];
  memos: DecisionMemo[];
}) {
  return (
    <div className="activation-layout activity-layout">
      <section className="workspace-card activation-list">
        <div className="panel-heading">
          <div>
            <h2>Workspace activity</h2>
            <p>An append-only record of project, evidence, document and execution changes.</p>
          </div>
          <ClipboardCheck />
        </div>
        {activity.length === 0 ? (
          <div className="compact-empty">Activity will appear after the next workspace change.</div>
        ) : (
          activity.map((item) => (
            <article className="activation-row activity-row" key={item.id}>
              <div>
                <b>{item.summary}</b>
                <small>
                  {label(item.entity_type)} · {label(item.event_type)}
                </small>
              </div>
              <time>{new Date(item.created_at).toLocaleString("en-GB")}</time>
            </article>
          ))
        )}
      </section>
      <section className="workspace-card activation-list">
        <div className="panel-heading">
          <div>
            <h2>Saved decision memos</h2>
            <p>Immutable snapshots preserve what the team knew at each decision point.</p>
          </div>
          <FileText />
        </div>
        {memos.length === 0 ? (
          <div className="compact-empty">Save the first snapshot from the report tab.</div>
        ) : (
          memos.map((memo) => (
            <article className="activation-row" key={memo.id}>
              <div>
                <b>Decision memo v{memo.version}</b>
                <small>{memo.recommended_next_action}</small>
              </div>
              <span className="status">{memo.readiness_score}/100</span>
              <time>{new Date(memo.created_at).toLocaleDateString("en-GB")}</time>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
