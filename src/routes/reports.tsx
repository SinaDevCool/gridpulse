import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Download, FileText, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/product/AppShell";
import {
  exportAnonymousWorkspace,
  listAnonymousProperties,
  subscribeAnonymousWorkspace,
  getWorkspaceSettings,
  saveWorkspaceSettings,
} from "@/features/anonymous-workspace/repository";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import {
  defaultWorkspaceSettings,
  type AnonymousWorkspaceSettings,
} from "@/features/anonymous-workspace/schema";
import {
  anonymousPropertyToDecisionRow,
  projectAnonymousProperty,
} from "@/features/anonymous-workspace/portfolio-projection";
import {
  buildPortfolioIntelligence,
  type PortfolioRiskFilter,
  type PortfolioSort,
} from "@/features/grid-connection/portfolio-intelligence";
import { downloadPortfolioComparisonPdf } from "@/features/properties/capacity-dossier";
import {
  downloadPropertyCsv,
  downloadPropertyGeoJson,
  downloadPropertyXlsx,
  type ExportableProperty,
} from "@/features/properties/property-export";

export const Route = createFileRoute("/reports")({
  validateSearch: z.object({
    operator: z.string().max(160).optional(),
    risk: z.enum(["all", "blocked", "deadline", "operator_confirmed"]).optional(),
    sort: z.enum(["urgency", "evidence", "mw", "name"]).optional(),
    decision: z.enum(["all", "unreviewed", "advance", "hold", "reject"]).optional(),
    view: z.enum(["priority", "qualification", "operator", "decisions"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Decision Centre | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DecisionCentre,
});

function exportable(property: AnonymousProperty): ExportableProperty {
  const summary = projectAnonymousProperty(property);
  return {
    id: property.id,
    name: property.name,
    project_type: summary.projectType,
    latitude: property.project.latitude!,
    longitude: property.project.longitude!,
    requested_import_mw: summary.requiredMw,
    requested_export_mw: property.exportRequirementMw ?? property.project.exportMw,
    likely_network_operator: summary.operator,
    operator_status: summary.operator ? "screening_context" : "not_assessed",
    planning_status: "not_assessed",
    land_status: property.landControlStatus,
    assessment_status: property.decisionStatus,
    qualification_readiness: summary.qualificationReadiness,
    operator_engagement_status: summary.operatorEngagementStage,
    critical_blockers: summary.criticalBlockers,
    boundary: property.boundary,
  };
}
function downloadBackup(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "gridpulse-workspace-backup.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

function DecisionCentre() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [properties, setProperties] = useState<AnonymousProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = () =>
    void listAnonymousProperties().then((items) => {
      setProperties(items);
      setLoading(false);
    });
  useEffect(() => {
    refresh();
    return subscribeAnonymousWorkspace(refresh);
  }, []);
  const summaries = useMemo(() => properties.map(projectAnonymousProperty), [properties]);
  const allRows = useMemo(() => properties.map(anonymousPropertyToDecisionRow), [properties]);
  const decisionRows = useMemo(
    () =>
      search.decision && search.decision !== "all"
        ? allRows.filter(
            (row) =>
              properties.find((property) => property.id === row.site_id)?.decisionStatus ===
              search.decision,
          )
        : allRows,
    [allRows, properties, search.decision],
  );
  const intelligence = useMemo(
    () =>
      buildPortfolioIntelligence(decisionRows, {
        operator: search.operator ?? "all",
        risk: (search.risk ?? "all") as PortfolioRiskFilter,
        sort: (search.sort ?? "urgency") as PortfolioSort,
      }),
    [decisionRows, search.operator, search.risk, search.sort],
  );
  const rows = properties.map(exportable);
  const patchSearch = (patch: Partial<typeof search>) =>
    void navigate({ to: "/reports", search: { ...search, ...patch }, replace: true });
  const advanced = properties.filter((property) => property.decisionStatus === "advance").length;
  const operatorIdentified = summaries.filter((site) => site.operator).length;
  const validated = summaries.filter((site) => site.capacityState === "validated").length;

  return (
    <AppShell>
      <main id="main-content" className="decision-centre-page decision-workspace-page">
        <aside className="decision-workspace-rail" aria-label="Decision Centre controls">
          <header>
            <p className="context-label">Portfolio Intelligence</p>
            <h1>Decision Centre</h1>
            <p>Prioritise sites, expose evidence gaps, and prepare stakeholder-ready records.</p>
          </header>
          <section className="rail-section">
            <h2>
              <BarChart3 aria-hidden="true" /> Portfolio Scope
            </h2>
            <label>
              Decision
              <select
                name="decision-centre-decision"
                value={search.decision ?? "all"}
                onChange={(event) =>
                  patchSearch({ decision: event.target.value as typeof search.decision })
                }
              >
                <option value="all">All Decisions</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="advance">Advance</option>
                <option value="hold">Hold</option>
                <option value="reject">Reject</option>
              </select>
            </label>
            <label>
              Evidence Exposure
              <select
                name="decision-centre-risk"
                value={search.risk ?? "all"}
                onChange={(event) =>
                  patchSearch({ risk: event.target.value as PortfolioRiskFilter })
                }
              >
                <option value="all">All Sites</option>
                <option value="blocked">Blocked by Evidence</option>
                <option value="deadline">Validity Deadline</option>
                <option value="operator_confirmed">Validated Evidence</option>
              </select>
            </label>
            <label>
              Operator Context
              <select
                name="decision-centre-operator"
                value={search.operator ?? "all"}
                onChange={(event) =>
                  patchSearch({
                    operator: event.target.value === "all" ? undefined : event.target.value,
                  })
                }
              >
                <option value="all">All Operators</option>
                {intelligence.operators.map((item) => (
                  <option key={item.operator} value={item.operator}>
                    {item.operator}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                name="decision-centre-sort"
                value={search.sort ?? "urgency"}
                onChange={(event) => patchSearch({ sort: event.target.value as PortfolioSort })}
              >
                <option value="urgency">Decision Urgency</option>
                <option value="evidence">Evidence Strength</option>
                <option value="mw">Required MW</option>
                <option value="name">Site Name</option>
              </select>
            </label>
          </section>
          <section className="rail-section export-menu">
            <h2>
              <Download aria-hidden="true" /> Decision Packages
            </h2>
            <button
              type="button"
              disabled={!rows.length}
              onClick={() => downloadPortfolioComparisonPdf(rows)}
            >
              Portfolio Decision PDF
            </button>
            <button type="button" disabled={!rows.length} onClick={() => downloadPropertyCsv(rows)}>
              Export CSV
            </button>
            <button
              type="button"
              disabled={!rows.length}
              onClick={() => void downloadPropertyXlsx(rows)}
            >
              Export XLSX
            </button>
            <button
              type="button"
              disabled={!rows.length}
              onClick={() => downloadPropertyGeoJson(rows)}
            >
              Export GeoJSON
            </button>
            <button
              type="button"
              onClick={async () => downloadBackup(await exportAnonymousWorkspace())}
            >
              Workspace Backup
            </button>
          </section>
          <WorkspaceBranding />
          <p className="rail-boundary">
            <ShieldAlert aria-hidden="true" /> Portfolio exposure aggregates requirements and
            evidence maturity—not available grid capacity or connection probability.
          </p>
        </aside>
        <section className="decision-workspace-main">
          <header className="workspace-main-header">
            <div>
              <p className="context-label">Evidence-Led Portfolio Review</p>
              <h2>Portfolio Decision Exposure</h2>
              <p>
                {properties.length} locally stored {properties.length === 1 ? "site" : "sites"}
              </p>
            </div>
            {rows.length ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => downloadPortfolioComparisonPdf(rows)}
              >
                <Download aria-hidden="true" /> Portfolio PDF
              </button>
            ) : null}
          </header>
          <nav className="decision-view-switcher" aria-label="Decision Centre view">
            {(["priority", "qualification", "operator", "decisions"] as const).map((view) => (
              <button
                key={view}
                className={(search.view ?? "priority") === view ? "active" : ""}
                onClick={() => patchSearch({ view })}
              >
                {view === "priority"
                  ? "Priority queue"
                  : view === "qualification"
                    ? "Qualification matrix"
                    : view === "operator"
                      ? "Operator pipeline"
                      : "Decision register"}
              </button>
            ))}
          </nav>
          {loading ? (
            <div className="decision-empty" role="status">
              <div className="loading-spinner" /> Loading decision intelligence…
            </div>
          ) : !properties.length ? (
            <div className="decision-empty">
              <FileText aria-hidden="true" />
              <h2>No Decision Records Yet</h2>
              <p>Save or import a site before reviewing portfolio exposure.</p>
              <Link to="/power-finder" className="primary-button">
                Screen a Site
              </Link>
            </div>
          ) : (
            <>
              <section className="decision-kpi-strip" aria-label="Portfolio decision metrics">
                <Kpi
                  label="Declared Demand"
                  value={`${number.format(intelligence.metrics.totalMw)} MW`}
                />
                <Kpi
                  label="MW Requiring Evidence"
                  value={`${number.format(intelligence.metrics.atRiskMw)} MW`}
                  tone="warning"
                />
                <Kpi
                  label="Action Required"
                  value={intelligence.metrics.urgentProjects}
                  tone="warning"
                />
                <Kpi label="Advanced" value={advanced} tone="positive" />
                <Kpi label="Operator Identified" value={operatorIdentified} />
                <Kpi label="Validated Evidence" value={validated} tone="positive" />
              </section>
              {(search.view ?? "priority") === "qualification" ? (
                <QualificationPortfolio summaries={summaries} />
              ) : null}
              {(search.view ?? "priority") === "operator" ? (
                <OperatorPipeline summaries={summaries} />
              ) : null}
              {(search.view ?? "priority") === "decisions" ? (
                <DecisionRegister summaries={summaries} />
              ) : null}
              {(search.view ?? "priority") === "priority" ? (
                <>
                  <section className="decision-priority-section">
                    <header>
                      <div>
                        <p className="context-label">Decision Work Queue</p>
                        <h2>Priority Sites</h2>
                      </div>
                      <span>{intelligence.rows.length} shown</span>
                    </header>
                    {intelligence.rows.length ? (
                      <div className="decision-priority-list">
                        {intelligence.rows.map((row) => {
                          const summary = summaries.find((site) => site.id === row.site_id)!;
                          return (
                            <article key={row.site_id} data-severity={row.risk.severity}>
                              <div>
                                <span className={`decision-chip is-${summary.decisionStatus}`}>
                                  {summary.decisionStatus}
                                </span>
                                <h3>{row.site_name}</h3>
                                <p>
                                  {summary.locationLabel} ·{" "}
                                  {summary.projectType.replaceAll("_", " ")}
                                </p>
                              </div>
                              <dl>
                                <div>
                                  <dt>Required</dt>
                                  <dd>{number.format(row.requested_import_mw)} MW</dd>
                                </div>
                                <div>
                                  <dt>Preferred Candidate</dt>
                                  <dd>
                                    {summary.preferredCandidate?.nodeName ?? "Not shortlisted"}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Operator</dt>
                                  <dd>{row.operator_name ?? "Unconfirmed"}</dd>
                                </div>
                                <div>
                                  <dt>Evidence</dt>
                                  <dd>
                                    {row.evidence_score ? `${row.evidence_score}/100` : "Unknown"}
                                  </dd>
                                </div>
                              </dl>
                              <p className="priority-blocker">
                                <b>Primary blocker</b>
                                {row.missing_evidence[0] ?? "No open evidence blocker"}
                              </p>
                              <p className="priority-next">
                                <b>Next</b>
                                {summary.nextAction}
                              </p>
                              <Link to="/capacity-dossiers/$id" params={{ id: row.site_id }}>
                                Open Decision Record <ArrowRight aria-hidden="true" />
                              </Link>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="decision-empty compact">
                        <h3>No Sites Match This Scope</h3>
                        <p>Choose another decision, evidence, or operator filter.</p>
                      </div>
                    )}
                  </section>
                </>
              ) : null}
              <section className="operator-exposure-section">
                <header>
                  <div>
                    <p className="context-label">Portfolio Concentration</p>
                    <h2>Operator Context</h2>
                  </div>
                  <p>Declared demand grouped by mapped operator context.</p>
                </header>
                <div>
                  {intelligence.operators.map((item) => (
                    <article key={item.operator}>
                      <span>{item.operator}</span>
                      <strong>{number.format(item.requestedMw)} MW</strong>
                      <small>
                        {item.projects} {item.projects === 1 ? "site" : "sites"}
                      </small>
                    </article>
                  ))}
                </div>
              </section>
              <section className="decision-record-index">
                <header>
                  <div>
                    <p className="context-label">Stakeholder Evidence</p>
                    <h2>Site Decision Records</h2>
                  </div>
                </header>
                <div>
                  {summaries.map((site) => (
                    <article key={site.id}>
                      <div>
                        <span className={`decision-chip is-${site.decisionStatus}`}>
                          {site.decisionStatus}
                        </span>
                        <h3>{site.name}</h3>
                        <p>
                          {site.requiredMw} MW declared ·{" "}
                          {site.preferredCandidate?.nodeName ?? "No candidate shortlisted"}
                        </p>
                      </div>
                      <dl>
                        <div>
                          <dt>Evidence</dt>
                          <dd>
                            {site.evidenceScore == null ? "Unknown" : `${site.evidenceScore}/100`}
                          </dd>
                        </div>
                        <div>
                          <dt>Capacity</dt>
                          <dd>{site.capacityState === "validated" ? "Validated" : "Unknown"}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>
                            {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                              new Date(site.updatedAt),
                            )}
                          </dd>
                        </div>
                      </dl>
                      <Link to="/capacity-dossiers/$id" params={{ id: site.id }}>
                        Open Record <ArrowRight aria-hidden="true" />
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function WorkspaceBranding() {
  const [settings, setSettings] = useState<AnonymousWorkspaceSettings>(defaultWorkspaceSettings);
  useEffect(() => {
    void getWorkspaceSettings().then(setSettings);
  }, []);
  return (
    <details className="rail-section workspace-data-menu">
      <summary>Report branding</summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await saveWorkspaceSettings(settings);
        }}
      >
        <label>
          Organisation
          <input
            value={settings.organisationName}
            onChange={(event) => setSettings({ ...settings, organisationName: event.target.value })}
          />
        </label>
        <label>
          Prepared for
          <input
            value={settings.preparedFor}
            onChange={(event) => setSettings({ ...settings, preparedFor: event.target.value })}
          />
        </label>
        <label>
          Classification
          <input
            value={settings.confidentialityLabel}
            onChange={(event) =>
              setSettings({ ...settings, confidentialityLabel: event.target.value })
            }
          />
        </label>
        <label>
          Report footer
          <textarea
            rows={3}
            value={settings.reportFooter}
            onChange={(event) => setSettings({ ...settings, reportFooter: event.target.value })}
          />
        </label>
        <button type="submit">Save branding</button>
      </form>
    </details>
  );
}

const matrixKeys = ["land", "planning", "grid", "fibre", "environment", "municipality"] as const;
function QualificationPortfolio({
  summaries,
}: {
  summaries: ReturnType<typeof projectAnonymousProperty>[];
}) {
  return (
    <section className="portfolio-matrix-section">
      <header>
        <div>
          <p className="context-label">Development readiness</p>
          <h2>Qualification matrix</h2>
        </div>
      </header>
      <div className="portfolio-matrix">
        <div className="matrix-head">
          <b>Site</b>
          {matrixKeys.map((key) => (
            <b key={key}>{key}</b>
          ))}
        </div>
        {summaries.map((site) => (
          <Link
            key={site.id}
            to="/portfolio/$id"
            params={{ id: site.id }}
            search={{ tab: "qualification" }}
          >
            <strong>
              {site.name}
              <small>{site.qualificationReadiness}% ready</small>
            </strong>
            {matrixKeys.map((key) => {
              const dimension = site.property.qualification?.find((item) => item.key === key);
              return (
                <span
                  key={key}
                  className={`matrix-status status-${dimension?.status ?? "unknown"}`}
                  title={`${key}: ${dimension?.status ?? "unknown"}`}
                >
                  {dimension?.status ?? "unknown"}
                </span>
              );
            })}
          </Link>
        ))}
      </div>
    </section>
  );
}

function OperatorPipeline({
  summaries,
}: {
  summaries: ReturnType<typeof projectAnonymousProperty>[];
}) {
  const stages = [
    "not_started",
    "preparing",
    "submitted",
    "acknowledged",
    "response_received",
    "closed",
  ];
  return (
    <section className="operator-pipeline-section">
      <header>
        <div>
          <p className="context-label">Operator engagement</p>
          <h2>Enquiry pipeline</h2>
        </div>
      </header>
      <div className="operator-pipeline">
        {stages.map((stage) => (
          <section key={stage}>
            <h3>{stage.replaceAll("_", " ")}</h3>
            {summaries
              .filter((site) => site.operatorEngagementStage === stage)
              .map((site) => (
                <Link
                  key={site.id}
                  to="/portfolio/$id"
                  params={{ id: site.id }}
                  search={{ tab: "evidence" }}
                >
                  <b>{site.name}</b>
                  <span>{site.operator ?? "Operator unconfirmed"}</span>
                  <small>
                    {site.requiredMw} MW ·{" "}
                    {site.evidenceExpiringSoon
                      ? `${site.evidenceExpiringSoon} expiring`
                      : "No expiry alert"}
                  </small>
                </Link>
              ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function DecisionRegister({
  summaries,
}: {
  summaries: ReturnType<typeof projectAnonymousProperty>[];
}) {
  return (
    <section className="decision-register-section">
      <header>
        <div>
          <p className="context-label">Recommendation history</p>
          <h2>Decision register</h2>
        </div>
      </header>
      <div>
        {[...summaries]
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
          .map((site) => (
            <article key={site.id}>
              <span>
                {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                  new Date(site.updatedAt),
                )}
              </span>
              <div>
                <b>{site.name}</b>
                <p>{site.property.decisionRationale ?? "No rationale recorded"}</p>
              </div>
              <span className={`decision-chip is-${site.decisionStatus}`}>
                {site.decisionStatus}
              </span>
              <Link to="/capacity-dossiers/$id" params={{ id: site.id }}>
                Open record
              </Link>
            </article>
          ))}
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <article className={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
