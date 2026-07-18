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
  created_at: string;
  document_count: number;
  requirement_ready: number;
  requirement_total: number;
  envelope_status: string;
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
      const [siteResult, documentResult, requirementResult, envelopeResult] = await Promise.all([
        supabase
          .from("candidate_sites")
          .select(
            "id,name,project_type,latitude,longitude,requested_import_mw,requested_export_mw,assessment_status,operator_status,created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("assessment_documents").select("site_id"),
        supabase.from("operator_requirements").select("site_id,status"),
        supabase
          .from("fca_envelopes")
          .select("site_id,status,version")
          .order("version", { ascending: false }),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (documentResult.error) throw documentResult.error;
      if (requirementResult.error) throw requirementResult.error;
      if (envelopeResult.error) throw envelopeResult.error;
      const readyStatuses = new Set(["ready", "submitted", "accepted", "not_applicable"]);
      return siteResult.data.map((site) => {
        const requirements = requirementResult.data.filter((item) => item.site_id === site.id);
        return {
          ...site,
          document_count: documentResult.data.filter((item) => item.site_id === site.id).length,
          requirement_ready: requirements.filter((item) => readyStatuses.has(item.status)).length,
          requirement_total: requirements.length,
          envelope_status:
            envelopeResult.data.find((item) => item.site_id === site.id)?.status ?? "not_started",
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
                    <dd>{label(project.operator_status)}</dd>
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
