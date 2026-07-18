import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BatteryCharging, MapPin, Plus } from "lucide-react";
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
      const { data, error: queryError } = await supabase
        .from("candidate_sites")
        .select(
          "id,name,project_type,latitude,longitude,requested_import_mw,requested_export_mw,assessment_status,operator_status,created_at",
        )
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      return data as CandidateSite[];
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
          eyebrow="Project portfolio"
          title="Connection assessments"
          description="Compare candidate sites, evidence readiness, and operator-validation status."
          action={
            <Link to="/assessments/new" className="primary-button">
              <Plus size={15} /> New assessment
            </Link>
          }
        />
        <div className="summary-grid">
          <div>
            <span>Active assessments</span>
            <b>{projects.length}</b>
            <small>Private workspace</small>
          </div>
          <div>
            <span>Awaiting evidence</span>
            <b>{awaitingEvidence}</b>
            <small>No capacity conclusions yet</small>
          </div>
          <div>
            <span>Report ready</span>
            <b>{reportReady}</b>
            <small>Evidence gate is active</small>
          </div>
        </div>
        <div className="section-toolbar">
          <div>
            <button className="filter-active">All projects</button>
            <button>Draft</button>
            <button>In review</button>
            <button>Report ready</button>
          </div>
          <span>{projects.length} assessments</span>
        </div>
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
            <h2>No assessments yet</h2>
            <p>Create your first candidate site to begin collecting evidence.</p>
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
