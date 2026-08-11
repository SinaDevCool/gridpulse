import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  ChevronDown,
  Plus,
  Search,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import {
  derivePortfolioProject,
  filterPortfolioProjects,
  type PortfolioProject,
  type PortfolioSort,
  type PortfolioStage,
} from "@/features/grid-connection/portfolio-model";
import { supabase } from "@/integrations/supabase/client";
import { ConnectionDecisionBoard } from "@/features/grid-connection/ConnectionDecisionBoard";
import { PropertyImportPanel } from "@/features/properties/PropertyImportPanel";

const stages: Array<{ value: PortfolioStage; label: string }> = [
  { value: "all", label: "All" },
  { value: "action_required", label: "Action required" },
  { value: "screening", label: "Screening" },
  { value: "preparing", label: "Preparing" },
  { value: "awaiting_operator", label: "Awaiting operator" },
  { value: "decision_ready", label: "Decision ready" },
];
export const Route = createFileRoute("/portfolio")({
  validateSearch: z.object({
    view: z.enum(["qualification", "delivery"]).optional(),
    q: z.string().max(160).optional(),
    stage: z
      .enum([
        "all",
        "action_required",
        "screening",
        "preparing",
        "awaiting_operator",
        "decision_ready",
      ])
      .optional(),
    sort: z.enum(["priority", "deadline", "newest", "name"]).optional(),
    expanded: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Connection Portfolio | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Portfolio,
});

function groupCount<T extends { site_id: string }>(items: T[]) {
  return items.reduce<Record<string, number>>((groups, item) => {
    groups[item.site_id] = (groups[item.site_id] ?? 0) + 1;
    return groups;
  }, {});
}

function groupItems<T extends { site_id: string }>(items: T[]) {
  return items.reduce<Map<string, T[]>>((groups, item) => {
    groups.set(item.site_id, [...(groups.get(item.site_id) ?? []), item]);
    return groups;
  }, new Map());
}

function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const query = search.q ?? "";
  const view = search.view ?? "qualification";
  const stage = search.stage ?? "all";
  const sort = search.sort ?? "priority";
  const expanded = search.expanded ?? "";
  const updateSearch = (patch: Partial<typeof search>) =>
    navigate({ to: "/portfolio", search: { ...search, ...patch }, replace: true });
  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["candidate-sites", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      await supabase.rpc("accept_assessment_invitations");
      const [sites, documents, requirements, envelopes, profiles, milestones, reviews] =
        await Promise.all([
          supabase
            .from("candidate_sites")
            .select(
              "id,name,project_type,latitude,longitude,requested_import_mw,requested_export_mw,assessment_status,operator_status,likely_network_operator,operator_confirmation_status,operator_profile_key,decision_status,created_at",
            )
            .neq("assessment_status", "archived")
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
            .eq("status", "open"),
          supabase.from("assessment_reviews").select("site_id,status,due_at,assigned_to_email"),
        ]);
      for (const result of [
        sites,
        documents,
        requirements,
        envelopes,
        profiles,
        milestones,
        reviews,
      ]) {
        if (result.error) throw result.error;
      }
      const siteRows = sites.data ?? [];
      const documentRows = documents.data ?? [];
      const requirementRows = requirements.data ?? [];
      const envelopeRows = envelopes.data ?? [];
      const profileRows = profiles.data ?? [];
      const milestoneRows = milestones.data ?? [];
      const reviewRows = reviews.data ?? [];
      const documentCounts = groupCount(documentRows);
      const profileCounts = groupCount(profileRows);
      const readyStatuses = new Set(["ready", "submitted", "accepted", "not_applicable"]);
      const requirementsBySite = groupItems(requirementRows);
      const reviewsBySite = groupItems(reviewRows);
      const milestonesBySite = groupItems(milestoneRows);
      const envelopeBySite = new Map<string, (typeof envelopeRows)[number]>();
      envelopeRows.forEach((envelope) => {
        if (!envelopeBySite.has(envelope.site_id)) envelopeBySite.set(envelope.site_id, envelope);
      });
      return siteRows.map((site) => {
        const siteRequirements = requirementsBySite.get(site.id) ?? [];
        const siteMilestones = milestonesBySite.get(site.id) ?? [];
        const firstMilestone = [...siteMilestones].sort(
          (a, b) => Date.parse(a.due_at) - Date.parse(b.due_at),
        )[0];
        return derivePortfolioProject({
          ...site,
          documents: documentCounts[site.id] ?? 0,
          requirementsReady: siteRequirements.filter((item) => readyStatuses.has(item.status))
            .length,
          requirementsTotal: siteRequirements.length,
          hasIntervalProfile: Boolean(profileCounts[site.id]),
          envelopeStatus: envelopeBySite.get(site.id)?.status ?? "not_started",
          milestoneDueAt: firstMilestone?.due_at ?? null,
          reviews: reviewsBySite.get(site.id) ?? [],
        });
      });
    },
  });

  const visibleProjects = filterPortfolioProjects(projects, query, stage, sort);
  const summary = {
    needsAction: projects.filter((project) => project.needsAction).length,
    evidenceBlocked: projects.filter((project) => project.evidenceBlocked).length,
    packageReady: projects.filter((project) => project.packageReady).length,
    overdue: projects.reduce((total, project) => total + project.overdueActions, 0),
  };
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page portfolio-page">
        <PageHeading
          eyebrow="Property & grid decision workspace"
          title="Property portfolio"
          description="Compare property readiness and grid evidence before deciding where deeper technical and commercial work is justified. Public context is not available grid capacity."
          action={
            <Link to="/assessments/new" className="primary-button">
              <Plus size={15} aria-hidden="true" /> New project
            </Link>
          }
        />

        <nav className="portfolio-view-tabs" aria-label="Portfolio view">
          <button type="button" aria-pressed={view === "qualification"} className={view === "qualification" ? "filter-active" : ""} onClick={() => void updateSearch({ view: "qualification", expanded: undefined })}>Property Qualification</button>
          <button type="button" aria-pressed={view === "delivery"} className={view === "delivery" ? "filter-active" : ""} onClick={() => void updateSearch({ view: "delivery", expanded: undefined })}>Connection Delivery</button>
        </nav>

        <PropertyImportPanel onImported={() => void refetch()} />

        {isLoading ? (
          <div className="portfolio-state" role="status" aria-live="polite">
            <div className="loading-spinner" />
            <p>Loading private projects…</p>
          </div>
        ) : error ? (
          <div className="portfolio-state error-message" role="alert">
            <AlertTriangle aria-hidden="true" />
            <h2>Projects could not be loaded</h2>
            <p>Refresh the data or try again shortly.</p>
            <button className="secondary-button" type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="portfolio-state">
            <BatteryCharging aria-hidden="true" />
            <h2>No connection projects yet</h2>
            <p>Add a candidate site to begin evidence-led screening and connection planning.</p>
            <Link to="/assessments/new" className="primary-button">
              <Plus size={15} aria-hidden="true" /> Create project
            </Link>
          </div>
        ) : (
          <>
            {view === "delivery" ? <ConnectionDecisionBoard /> : null}
            {view === "qualification" ? (
              <PropertyQualificationTable projects={visibleProjects} />
            ) : (
              <>
            <section className="portfolio-summary" aria-label="Portfolio priorities">
              <Metric
                label="Needs action"
                value={summary.needsAction}
                detail="Open blocker or review gate"
                tone="warning"
              />
              <Metric
                label="Blocked by evidence"
                value={summary.evidenceBlocked}
                detail="Customer-side package incomplete"
              />
              <Metric
                label="Package ready"
                value={summary.packageReady}
                detail="Ready for operator engagement"
                tone="positive"
              />
              <Metric
                label="Overdue actions"
                value={summary.overdue}
                detail="Open review or milestone due"
                tone="danger"
              />
            </section>

            <section className="portfolio-work-queue" aria-labelledby="work-queue-title">
              <div className="portfolio-controls">
                <div>
                  <h2 id="work-queue-title">Decision work queue</h2>
                  <p>
                    {visibleProjects.length} of {projects.length} projects shown
                  </p>
                </div>
                <label className="portfolio-search">
                  <span className="sr-only">Search projects</span>
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    name="project-search"
                    autoComplete="off"
                    placeholder="Search project or operator…"
                    value={query}
                    onChange={(event) => {
                      void updateSearch({
                        q: event.target.value || undefined,
                        expanded: undefined,
                      });
                    }}
                  />
                </label>
                <label className="portfolio-sort">
                  <span>Sort</span>
                  <select
                    value={sort}
                    onChange={(event) =>
                      void updateSearch({ sort: event.target.value as PortfolioSort })
                    }
                  >
                    <option value="priority">Priority</option>
                    <option value="deadline">Next deadline</option>
                    <option value="newest">Newest</option>
                    <option value="name">Project name</option>
                  </select>
                </label>
              </div>
              <nav className="portfolio-filters" aria-label="Filter projects by workflow stage">
                {stages.map((stageOption) => {
                  const count =
                    stageOption.value === "all"
                      ? projects.length
                      : stageOption.value === "action_required"
                        ? summary.needsAction
                        : projects.filter((project) => project.stage === stageOption.value).length;
                  return (
                    <button
                      type="button"
                      key={stageOption.value}
                      className={stage === stageOption.value ? "filter-active" : ""}
                      aria-pressed={stage === stageOption.value}
                      onClick={() => {
                        void updateSearch({ stage: stageOption.value, expanded: undefined });
                      }}
                    >
                      {stageOption.label} <span>{count}</span>
                    </button>
                  );
                })}
              </nav>

              {visibleProjects.length === 0 ? (
                <div className="portfolio-no-results" role="status">
                  <h3>No projects match this view</h3>
                  <p>Clear the search or choose another workflow stage.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      void updateSearch({ q: undefined, stage: "all", expanded: undefined });
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="table-wrap portfolio-table-wrap">
                  <table className="portfolio-table">
                    <caption className="sr-only">
                      Connection projects ordered by the selected portfolio priority.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Project</th>
                        <th scope="col">Current gate</th>
                        <th scope="col">Customer-side evidence</th>
                        <th scope="col">Operator status</th>
                        <th scope="col">Next action</th>
                        <th scope="col">Owner &amp; due</th>
                        <th scope="col">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProjects.map((project) => (
                        <ProjectRows
                          key={project.id}
                          project={project}
                          expanded={expanded === project.id}
                          onToggle={() =>
                            void updateSearch({
                              expanded: expanded === project.id ? undefined : project.id,
                            })
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
              </>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

function PropertyQualificationTable({ projects }: { projects: PortfolioProject[] }) {
  return (
    <section className="portfolio-work-queue" aria-labelledby="qualification-table-title">
      <div className="portfolio-controls"><div><h2 id="qualification-table-title">Property qualification</h2><p>{projects.length} properties compared across separate decision dimensions</p></div></div>
      <div className="table-wrap portfolio-table-wrap">
        <table className="portfolio-table property-qualification-table">
          <caption className="sr-only">Property qualification comparison. Readiness and evidence are not available capacity.</caption>
          <thead><tr><th>Property</th><th>Required MW</th><th>Grid evidence</th><th>Property readiness</th><th>Planning readiness</th><th>Evidence completeness</th><th>Principal unknowns</th><th>Next action</th></tr></thead>
          <tbody>{projects.map((project) => (
            <tr key={project.id}>
              <td><Link to="/assessments/$id" params={{ id: project.id }}><b>{project.name}</b></Link><small>{label(project.project_type)}</small></td>
              <td><b>{project.requested_import_mw}</b><small>Import requirement, not capacity</small></td>
              <td><span className={`portfolio-chip operator-${project.operator_confirmation_status}`}>{project.operatorStatusLabel}</span><small>{project.likely_network_operator ?? "Operator unconfirmed"}</small></td>
              <td><b>{project.stageLabel}</b><small>{project.packageReady ? "Delivery inputs assembled" : "Inputs incomplete"}</small></td>
              <td><b>Not assessed</b><small>Planning evidence is not yet in this portfolio projection</small></td>
              <td><b>{project.readinessScore}%</b><small>Visible inputs; not a connection score</small></td>
              <td><b>{project.blockers.length || "None recorded"}</b><small>{project.blockers.slice(0, 2).join("; ") || "Review source evidence"}</small></td>
              <td><b>{project.nextAction}</b><small><Link to="/capacity-dossiers/$id" params={{ id: project.id }}>Open Capacity Dossier</Link></small></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: string;
}) {
  return (
    <div className={`portfolio-metric ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </div>
  );
}

function ProjectRows({
  project,
  expanded,
  onToggle,
}: {
  project: PortfolioProject;
  expanded: boolean;
  onToggle: () => void;
}) {
  const due = project.nextDeadline
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
        new Date(project.nextDeadline),
      )
    : "Not scheduled";
  return (
    <>
      <tr className={project.needsAction ? "needs-action" : ""}>
        <td>
          <b>{project.name}</b>
          <small>
            {label(project.project_type)} · {project.requested_import_mw} MW import
          </small>
        </td>
        <td>
          <span className={`portfolio-chip stage-${project.stage}`}>{project.stageLabel}</span>
          <small>
            {project.openReviews
              ? `${project.openReviews} open review gate${project.openReviews === 1 ? "" : "s"}`
              : "No open review gates"}
          </small>
        </td>
        <td>
          <b>{project.evidenceLabel}</b>
          <small>
            {project.documents} documents ·{" "}
            {project.hasIntervalProfile ? "Load profile recorded" : "Load profile missing"}
          </small>
        </td>
        <td>
          <span className={`portfolio-chip operator-${project.operator_confirmation_status}`}>
            {project.operatorStatusLabel}
          </span>
          <small>{project.likely_network_operator ?? "Responsible operator not routed"}</small>
        </td>
        <td>
          <b>{project.nextAction}</b>
          <small>
            {project.blockers.length
              ? `${project.blockers.length} blocker${project.blockers.length === 1 ? "" : "s"} visible`
              : "No customer-side blocker"}
          </small>
        </td>
        <td>
          <b>{project.owner}</b>
          <small className={project.overdueActions ? "overdue-text" : ""}>
            {project.overdueActions ? "Overdue · " : ""}
            {due}
          </small>
        </td>
        <td className="portfolio-row-actions">
          <Link to="/assessments/$id" params={{ id: project.id }}>
            Open <ArrowRight aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={`project-details-${project.id}`}
          >
            Details <ChevronDown aria-hidden="true" />
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="portfolio-detail-row" id={`project-details-${project.id}`}>
          <td colSpan={7}>
            <div className="portfolio-details">
              <div>
                <span>Requested capacity</span>
                <b>
                  {project.requested_import_mw} MW import · {project.requested_export_mw} MW export
                </b>
              </div>
              <div>
                <span>Coordinates</span>
                <b>
                  {Number(project.latitude).toFixed(4)}, {Number(project.longitude).toFixed(4)}
                </b>
              </div>
              <div>
                <span>FCA / connection envelope</span>
                <b>{label(project.envelopeStatus)}</b>
              </div>
              <div>
                <span>Customer-side readiness</span>
                <b>{project.readinessScore}/100</b>
                <small>Planning indicator, not operator-approved capacity</small>
              </div>
              <div className="portfolio-blocker-list">
                <span>Unresolved gates</span>
                {project.blockers.length ? (
                  <ul>
                    {project.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                ) : (
                  <b>No customer-side blockers recorded</b>
                )}
              </div>
              <Link to="/assessments/$id" params={{ id: project.id }} className="secondary-button">
                Open complete project <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
