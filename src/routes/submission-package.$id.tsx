import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Download, FileArchive, LoaderCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSubmissionManifest,
  submissionStatus,
} from "@/features/grid-connection/submission-package";
import { downloadSubmissionPdf } from "@/features/grid-connection/submission-pdf";
import { downloadJson } from "@/features/grid-connection/deliverables";

export const Route = createFileRoute("/submission-package/$id")({
  head: () => ({
    meta: [
      { title: "Submission Package | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SubmissionPackagePage,
});

const questions = [
  "Welcher Netzverknuepfungspunkt und welche Spannungsebene sind fuer den formellen Antrag massgeblich? / Which connection point and voltage level control the formal application?",
  "Welche gesicherte Bezugsleistung ist vor Abschluss der Netzverstaerkung moeglich? / What firm import is available before reinforcement?",
  "Kann eine flexible Netzanschlussvereinbarung nach Section 17(2b) EnWG angeboten werden? / Can a flexible connection agreement be offered?",
  "Welche statischen oder dynamischen Begrenzungen und Schnittstellen gelten? / Which restriction parameters and interfaces apply?",
  "Welche Studien, Sicherheiten, Flaechen und Unterlagen sind erforderlich? / Which studies, securities, land rights and documents are required?",
  "Welche Ausbau- oder Verfahrensmeilensteine veraendern den Anschlusskorridor? / Which milestones change the connection envelope?",
];

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function SubmissionPackagePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["submission-package", id, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const tables = await Promise.all([
        supabase.from("candidate_sites").select("*").eq("id", id).single(),
        supabase.from("assessment_evidence").select("*").eq("site_id", id).order("created_at"),
        supabase.from("assessment_documents").select("*").eq("site_id", id).order("created_at"),
        supabase.from("network_nodes").select("*").eq("site_id", id).order("created_at"),
        supabase.from("capacity_snapshots").select("*").eq("site_id", id).order("version"),
        supabase.from("connection_scenarios").select("*").eq("site_id", id).order("created_at"),
        supabase.from("operator_decisions").select("*").eq("site_id", id).order("created_at"),
        supabase.from("assessment_milestones").select("*").eq("site_id", id).order("due_at"),
        supabase.from("pilot_engagements").select("*").eq("site_id", id).maybeSingle(),
        supabase
          .from("submission_packages")
          .select("*")
          .eq("site_id", id)
          .order("version", { ascending: false }),
        supabase.rpc("get_assessment_role", { p_site_id: id }),
      ]);
      const failed = tables.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        site: tables[0].data as Record<string, unknown>,
        evidence: tables[1].data as Array<Record<string, unknown>>,
        documents: tables[2].data as Array<Record<string, unknown>>,
        nodes: tables[3].data as Array<Record<string, unknown>>,
        snapshots: tables[4].data as Array<Record<string, unknown>>,
        scenarios: tables[5].data as Array<Record<string, unknown>>,
        decisions: tables[6].data as Array<Record<string, unknown>>,
        milestones: tables[7].data as Array<Record<string, unknown>>,
        pilot: tables[8].data as Record<string, unknown> | null,
        packages: tables[9].data as Array<Record<string, unknown>>,
        role: String(tables[10].data ?? "none"),
      };
    },
  });
  const manifest = useMemo(
    () =>
      query.data
        ? buildSubmissionManifest({
            project: query.data.site,
            evidence: query.data.evidence,
            documents: query.data.documents,
            nodes: query.data.nodes,
            capacitySnapshots: query.data.snapshots,
            scenarios: query.data.scenarios,
            operatorDecisions: query.data.decisions,
            milestones: query.data.milestones,
            pilot: query.data.pilot,
            questions,
          })
        : null,
    [query.data],
  );
  if (query.isLoading)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <div className="loading-spinner" />
          <p>Assembling package…</p>
        </main>
      </AppShell>
    );
  if (!query.data || !manifest)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <h1>Package unavailable</h1>
          <p>{query.error instanceof Error ? query.error.message : "Project not available."}</p>
        </main>
      </AppShell>
    );
  const canEdit = [
    "owner",
    "customer_contributor",
    "technical_reviewer",
    "grid_expert",
    "workspace_admin",
  ].includes(query.data.role);
  const packageManifest = manifest;
  async function createPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const data = new FormData(event.currentTarget);
    const requested = String(data.get("status")) as
      | "draft"
      | "internal_review"
      | "approved_for_operator";
    const status = submissionStatus(packageManifest.counts.openGates, requested);
    if (requested !== status)
      toast.warning("Open release gates forced this package into internal review.");
    setBusy(true);
    const hash = await sha256(packageManifest);
    const { error } = await supabase.from("submission_packages").insert({
      site_id: id,
      user_id: user!.id,
      status,
      language: "de_en",
      title: data.get("title"),
      recipient_organization: data.get("recipient") || null,
      purpose: data.get("purpose"),
      manifest: packageManifest,
      manifest_hash: hash,
      evidence_count: packageManifest.counts.evidence,
      document_count: packageManifest.counts.documents,
      open_gate_count: packageManifest.counts.openGates,
      operator_confirmed_count: packageManifest.counts.operatorConfirmed,
      release_note: data.get("release_note"),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Immutable package version recorded");
      await client.invalidateQueries({ queryKey: ["submission-package", id] });
    }
  }
  const nextVersion = Number(query.data.packages[0]?.version ?? 0) + 1;
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page submission-page">
        <Link to="/assessments/$id" params={{ id }} className="back-link">
          <ArrowLeft /> Project workspace
        </Link>
        <header className="assessment-title">
          <div>
            <p className="context-label">Controlled operator engagement</p>
            <h1>Submission package</h1>
            <p>{String(query.data.site.name)} · bilingual DE/EN · immutable manifest</p>
          </div>
          <span className="status">v{nextVersion} preview</span>
        </header>
        <div className="truth-banner">
          <ShieldAlert />
          <div>
            <b>Release approval is not operator acceptance</b>
            <p>
              Only capacity versions explicitly labelled operator-confirmed are presented as
              operator evidence.
            </p>
          </div>
        </div>
        <section className="submission-summary">
          <article>
            <span>Evidence</span>
            <strong>{manifest.counts.evidence}</strong>
          </article>
          <article>
            <span>Documents</span>
            <strong>{manifest.counts.documents}</strong>
          </article>
          <article>
            <span>Operator-confirmed</span>
            <strong>{manifest.counts.operatorConfirmed}</strong>
          </article>
          <article>
            <span>Open release gates</span>
            <strong>{manifest.counts.openGates}</strong>
          </article>
        </section>
        <section className="workspace-card">
          <div className="panel-heading">
            <div>
              <h2>Release gates</h2>
              <p>All controls must pass before “approved for operator” can be recorded.</p>
            </div>
            <Check />
          </div>
          <div className="submission-gates">
            {manifest.releaseGates.map((gate) => (
              <div className={gate.complete ? "complete" : "open"} key={gate.key}>
                <Check /> <span>{gate.label}</span>
                <b>{gate.complete ? "Ready" : "Open"}</b>
              </div>
            ))}
          </div>
        </section>
        {canEdit ? (
          <form className="workspace-card activation-form submission-form" onSubmit={createPackage}>
            <div className="panel-heading">
              <div>
                <h2>Create controlled version {nextVersion}</h2>
                <p>The manifest hash makes the exact source set and release state traceable.</p>
              </div>
              <FileArchive />
            </div>
            <label>
              Package title
              <input
                name="title"
                defaultValue={`${String(query.data.site.name)} operator engagement package`}
                required
              />
            </label>
            <label>
              Recipient organization
              <input
                name="recipient"
                defaultValue={String(query.data.pilot?.responsible_dso ?? "")}
              />
            </label>
            <label>
              Purpose
              <textarea
                name="purpose"
                defaultValue="Request connection-point guidance, capacity study scope and flexible/staged connection parameters."
                required
              />
            </label>
            <label>
              Release state
              <select name="status">
                <option value="draft">Draft</option>
                <option value="internal_review">Internal review</option>
                <option value="approved_for_operator">Approved for operator</option>
              </select>
            </label>
            <label>
              Release note
              <textarea
                name="release_note"
                required
                placeholder="Who reviewed this version and what changed?"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <FileArchive />} Record version
            </button>
          </form>
        ) : null}
        <section className="workspace-card">
          <div className="panel-heading">
            <div>
              <h2>Package preview</h2>
              <p>
                {manifest.sections.questionsForOperator.length} operator questions ·{" "}
                {manifest.sections.networkNodes.length} nodes ·{" "}
                {manifest.sections.connectionScenarios.length} scenarios
              </p>
            </div>
            <Download />
          </div>
          <div className="submission-actions">
            <button
              onClick={() =>
                void downloadSubmissionPdf(
                  manifest,
                  nextVersion,
                  String(query.data.pilot?.responsible_dso ?? ""),
                )
              }
            >
              <Download /> Download preview PDF
            </button>
            <button
              onClick={() =>
                downloadJson(
                  `${String(query.data.site.name)}-submission-v${nextVersion}.json`,
                  manifest,
                )
              }
            >
              <Download /> Download manifest JSON
            </button>
          </div>
        </section>
        <section className="workspace-card">
          <div className="panel-heading">
            <div>
              <h2>Version history</h2>
              <p>Append-only controlled releases.</p>
            </div>
            <FileArchive />
          </div>
          {query.data.packages.length ? (
            <div className="submission-history">
              {query.data.packages.map((item) => (
                <article key={String(item.id)}>
                  <b>
                    v{String(item.version)} · {String(item.status)}
                  </b>
                  <span>{String(item.recipient_organization ?? "Recipient open")}</span>
                  <small>
                    {String(item.manifest_hash).slice(0, 16)}… ·{" "}
                    {new Date(String(item.created_at)).toLocaleString("de-DE")}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className="compact-empty">No controlled package version recorded.</div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
