import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BatteryCharging,
  ClipboardCheck,
  FileText,
  MapPin,
  Plus,
  Zap,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Portfolio,
});
type CandidateSite = {
  id: string;
  name: string;
  project_type: string;
  latitude: number;
  longitude: number;
  requested_import_mw: number;
  requested_export_mw: number;
  assessment_status: string;
  operator_status: string;
  likely_network_operator: string | null;
  operator_confirmation_status: string;
  operator_profile_key: string | null;
  decision_status: string;
  created_at: string;
  document_count: number;
  requirement_ready: number;
  requirement_total: number;
  envelope_status: string;
  readiness_score: number;
  next_action: string;
  next_deadline: string | null;
};

function Portfolio() {
  const { user } = useAuth();
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["candidate-sites", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      await supabase.rpc("accept_assessment_invitations");
      const [
        siteResult,
        documentResult,
        requirementResult,
        envelopeResult,
        profileResult,
        milestoneResult,
      ] = await Promise.all([
        supabase
          .from("candidate_sites")
          .select(
            "id,name,project_type,latitude,longitude,requested_import_mw,requested_export_mw,assessment_status,operator_status,likely_network_operator,operator_confirmation_status,operator_profile_key,decision_status,created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("assessment_documents").select("site_id"),
        supabase.from("operator_requirements").select("site_id,status"),
        supabase
          .from("fca_envelopes")
          .select("site_id,status,version")
          .order("version", { ascending: false }),
        supabase.from("interval_profiles").select("site_id"),
        supabase
          .from("assessment_milestones")
          .select("site_id,due_at,status")
          .eq("status", "open")
          .order("due_at"),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (documentResult.error) throw documentResult.error;
      if (requirementResult.error) throw requirementResult.error;
      if (envelopeResult.error) throw envelopeResult.error;
      if (profileResult.error) throw profileResult.error;
      if (milestoneResult.error) throw milestoneResult.error;
      const readyStatuses = new Set(["ready", "submitted", "accepted", "not_applicable"]);
      return siteResult.data.map((site) => {
        const requirements = requirementResult.data.filter((item) => item.site_id === site.id);
        const ready = requirements.filter((item) => readyStatuses.has(item.status)).length;
        const ratio = requirements.length ? ready / requirements.length : 0;
        const documents = documentResult.data.filter((item) => item.site_id === site.id).length;
        const hasProfile = profileResult.data.some((item) => item.site_id === site.id);
        const envelope = envelopeResult.data.find((item) => item.site_id === site.id);
        const operatorConfirmed = site.operator_confirmation_status !== "screening_only";
        const readinessScore = Math.min(
          100,
          Math.round(
            ratio * 55 +
              Math.min(documents, 5) * 4 +
              (hasProfile ? 10 : 0) +
              (operatorConfirmed ? 10 : 0) +
              (envelope?.status === "agreed" ? 5 : 0),
          ),
        );
        const nextAction = !site.operator_profile_key
          ? "Route operator"
          : !operatorConfirmed
            ? "Confirm operator"
            : ratio < 1
              ? "Complete application pack"
              : !envelope
                ? "Obtain operator response"
                : envelope.status !== "agreed"
                  ? "Negotiate envelope"
                  : "Prepare activation";
        return {
          ...site,
          document_count: documents,
          requirement_ready: ready,
          requirement_total: requirements.length,
          envelope_status: envelope?.status ?? "not_started",
          readiness_score: readinessScore,
          next_action: nextAction,
          next_deadline:
            milestoneResult.data.find((item) => item.site_id === site.id)?.due_at ?? null,
        } as CandidateSite;
      });
    },
  });
  const awaitingEvidence = projects.filter(
    (project) => project.assessment_status !== "report_ready",
  ).length;
  const reportReady = projects.filter(
    (project) => project.assessment_status === "report_ready",
  ).length;
  return (
    <AppShell requireAuth>
      <main className="section-page">
        <PageHeading
          eyebrow="Power acceleration portfolio"
          title="Activation projects"
          description="Move candidate sites from power discovery through connection activation to flexible-operation readiness."
          action={
            <Link to="/assessments/new" className="primary-button">
              <Plus size={15} /> New assessment
            </Link>
          }
        />
        <div className="summary-grid">
          <div>
            <span>Active projects</span>
            <b>{projects.length}</b>
            <small>Power discovery and activation</small>
          </div>
          <div>
            <span>Activation in progress</span>
            <b>{awaitingEvidence}</b>
            <small>No capacity conclusions yet</small>
          </div>
          <div>
            <span>Decision ready</span>
            <b>{reportReady}</b>
            <small>Operator-ready evidence pack</small>
          </div>
        </div>
        <div className="section-toolbar">
          <div>
            <button className="filter-active">All projects</button>
            <button>Draft</button>
            <button>In review</button>
            <button>Report ready</button>
          </div>
          <span>{projects.length} projects</span>
        </div>
        {projects.length > 0 ? (
          <section className="site-comparison workspace-card">
            <div className="panel-heading">
              <div>
                <h2>Candidate-site readiness comparison</h2>
                <p>
                  Comparison reflects collected evidence and workflow progress—not available
                  capacity.
                </p>
              </div>
              <ClipboardCheck />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Requirement</th>
                    <th>Documents</th>
                    <th>Operator pack</th>
                    <th>FCA envelope</th>
                    <th>Readiness</th>
                    <th>Next action</th>
                    <th>Deadline</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <b>{project.name}</b>
                        <small>{label(project.project_type)}</small>
                      </td>
                      <td>
                        <b>{project.readiness_score}/100</b>
                      </td>
                      <td>{project.next_action}</td>
                      <td>
                        {project.next_deadline
                          ? new Date(project.next_deadline).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>{project.requested_import_mw} MW import</td>
                      <td>
                        <FileText /> {project.document_count}
                      </td>
                      <td>
                        {project.requirement_ready}/{project.requirement_total || 8} ready
                      </td>
                      <td>
                        <span className="status">
                          <Zap /> {label(project.envelope_status)}
                        </span>
                      </td>
                      <td>
                        <Link to="/assessments/$id" params={{ id: project.id }}>
                          Open <ArrowRight />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {isLoading ? (
          <div className="portfolio-state">
            <div className="loading-spinner" />
            <p>Loading private assessments…</p>
          </div>
        ) : error ? (
          <div className="portfolio-state error-message">
            <p>{error instanceof Error ? error.message : "Could not load assessments."}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="portfolio-state">
            <BatteryCharging />
            <h2>No activation projects yet</h2>
            <p>Add a candidate site to begin power discovery and connection planning.</p>
            <Link to="/assessments/new" className="primary-button">
              <Plus size={15} /> Create assessment
            </Link>
          </div>
        ) : (
          <div className="portfolio-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card-top">
                  <span className="project-icon">
                    <BatteryCharging />
                  </span>
                  <span className="status warning-text">{label(project.assessment_status)}</span>
                </div>
                <h2>{project.name}</h2>
                <p>{label(project.project_type)}</p>
                <dl>
                  <div>
                    <dt>
                      <MapPin />
                      Coordinates
                    </dt>
                    <dd>
                      {Number(project.latitude).toFixed(4)}, {Number(project.longitude).toFixed(4)}
                    </dd>
                  </div>
                  <div>
                    <dt>Requirement</dt>
                    <dd>
                      {project.requested_import_mw} MW import / {project.requested_export_mw} MW
                      export
                    </dd>
                  </div>
                  <div>
                    <dt>Operator</dt>
                    <dd>{project.likely_network_operator ?? label(project.operator_status)}</dd>
                  </div>
                  <div>
                    <dt>Next action</dt>
                    <dd>{project.next_action}</dd>
                  </div>
                  <div>
                    <dt>Next deadline</dt>
                    <dd>
                      {project.next_deadline
                        ? new Date(project.next_deadline).toLocaleDateString()
                        : "Not scheduled"}
                    </dd>
                  </div>
                </dl>
                <Link to="/assessments/$id" params={{ id: project.id }}>
                  Open assessment <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
