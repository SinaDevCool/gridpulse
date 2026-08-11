import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Database,
  Download,
  FileUp,
  Filter,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/product/AppShell";
import { PropertyImportPanel } from "@/features/properties/PropertyImportPanel";
import { downloadPortfolioComparisonPdf } from "@/features/properties/capacity-dossier";
import { downloadPropertyXlsx } from "@/features/properties/property-export";
import { portfolioExportRow } from "@/features/site-portfolio/portfolio-export";
import {
  clearAnonymousWorkspace,
  deleteAnonymousProperty,
  exportAnonymousWorkspace,
  restoreAnonymousWorkspace,
} from "@/features/anonymous-workspace/repository";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import {
  projectAnonymousProperty,
  anonymousPropertyToDecisionRow,
  type AnonymousSiteStage,
} from "@/features/anonymous-workspace/portfolio-projection";
import { buildPortfolioIntelligence } from "@/features/grid-connection/portfolio-intelligence";
import { suggestScreeningVoltage } from "@/features/power-finder/site-screening-context";
import {
  PortfolioDecisionView,
  PortfolioReadinessView,
} from "@/features/site-portfolio/PortfolioViews";
import {
  portfolioDecisions,
  portfolioStages,
  portfolioStageLabels,
  portfolioViews,
} from "@/features/site-portfolio/portfolio-status";
import { useSitePortfolio } from "@/features/site-portfolio/use-site-portfolio";

const stages = portfolioStages;
const decisions = portfolioDecisions;

export const Route = createFileRoute("/portfolio")({
  validateSearch: z.object({
    q: z.string().max(160).optional(),
    view: z.enum(portfolioViews).optional(),
    stage: z.enum(stages).optional(),
    decision: z.enum(decisions).optional(),
    sort: z.enum(["priority", "updated", "name", "mw"]).optional(),
    risk: z.enum(["all", "blocked", "deadline", "operator_confirmed"]).optional(),
    operator: z.string().max(160).optional(),
    selected: z.string().uuid().optional(),
    import: z.literal("open").optional(),
  }),
  head: () => ({
    meta: [{ title: "Sites | GridPulse" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SitePipeline,
});

function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

const stageLabel: Record<AnonymousSiteStage, string> = portfolioStageLabels;

function SitePipeline() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/portfolio/")) return <Outlet />;
  return <SitePipelineIndex />;
}

function SitePipelineIndex() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const restoreInput = useRef<HTMLInputElement>(null);
  const {
    properties,
    summaries,
    loading,
    error,
    refresh,
    metrics,
    selectedSite: selected,
  } = useSitePortfolio(search.selected);
  const activeView = search.view ?? "pipeline";
  const importOpen = search.import === "open";
  const visible = useMemo(() => {
    const needle = (search.q ?? "").trim().toLocaleLowerCase();
    return summaries
      .filter((site) => {
        const queryMatch =
          !needle ||
          [site.name, site.locationLabel, site.operator, site.projectType, site.nextAction]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase().includes(needle));
        const stageMatch =
          !search.stage ||
          search.stage === "all" ||
          (search.stage === "action_required"
            ? site.blockers.length > 0
            : site.stage === search.stage);
        const decisionMatch =
          !search.decision || search.decision === "all" || site.decisionStatus === search.decision;
        return queryMatch && stageMatch && decisionMatch;
      })
      .sort((left, right) => {
        if (search.sort === "name") return left.name.localeCompare(right.name);
        if (search.sort === "mw") return right.requiredMw - left.requiredMw;
        if (search.sort === "updated")
          return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        return (
          Number(right.decisionStatus === "unreviewed") -
            Number(left.decisionStatus === "unreviewed") ||
          right.blockers.length - left.blockers.length ||
          right.requiredMw - left.requiredMw
        );
      });
  }, [search, summaries]);
  const patchSearch = (patch: Partial<typeof search>) =>
    void navigate({ to: "/portfolio", search: { ...search, ...patch }, replace: true });
  const decisionRows = useMemo(() => {
    const permittedIds = new Set(
      summaries
        .filter(
          (site) =>
            !search.decision ||
            search.decision === "all" ||
            site.decisionStatus === search.decision,
        )
        .map((site) => site.id),
    );
    return properties
      .filter((property) => permittedIds.has(property.id))
      .map(anonymousPropertyToDecisionRow);
  }, [properties, search.decision, summaries]);
  const intelligence = useMemo(
    () =>
      buildPortfolioIntelligence(decisionRows, {
        operator: search.operator ?? "all",
        risk: search.risk ?? "all",
        sort: search.sort === "name" || search.sort === "mw" ? search.sort : "urgency",
      }),
    [decisionRows, search.operator, search.risk, search.sort],
  );
  const scopedIds = useMemo(
    () => new Set(intelligence.rows.map((row) => row.site_id)),
    [intelligence.rows],
  );
  const decisionSites = useMemo(
    () => summaries.filter((site) => scopedIds.has(site.id)),
    [scopedIds, summaries],
  );
  const exportIds = useMemo(
    () => new Set((search.view === "pipeline" ? visible : decisionSites).map((site) => site.id)),
    [decisionSites, search.view, visible],
  );
  const exportRows = useMemo(
    () =>
      properties
        .filter((property) => exportIds.has(property.id))
        .map(portfolioExportRow)
        .filter((row) => row != null),
    [exportIds, properties],
  );
  const filtersActive = Boolean(
    search.q ||
    (search.stage && search.stage !== "all") ||
    (search.decision && search.decision !== "all") ||
    (search.sort && search.sort !== "priority") ||
    (search.risk && search.risk !== "all") ||
    search.operator,
  );

  return (
    <AppShell>
      <main id="main-content" className="site-pipeline-page decision-workspace-page">
        <aside className="decision-workspace-rail" aria-label="Sites controls">
          <header>
            <p className="context-label">Portfolio Workspace</p>
            <h1>Sites</h1>
            <p>Screen, qualify, and make evidence-led decisions across the portfolio.</p>
          </header>
          <section className="rail-metrics" aria-label="Portfolio summary">
            <Metric label="Sites" value={metrics.sites} />
            <Metric label="Declared" value={`${metrics.declaredMw.toLocaleString("en-GB")} MW`} />
            <Metric label="Action" value={metrics.actionRequired} tone="warning" />
            <Metric label="Ready" value={metrics.decisionReady} tone="positive" />
          </section>
          <section className="rail-section">
            <h2>
              <Filter aria-hidden="true" /> Portfolio View
            </h2>
            <label className="rail-search">
              <span className="sr-only">Search sites</span>
              <Search aria-hidden="true" />
              <input
                name="site-search"
                type="search"
                autoComplete="off"
                placeholder="Search site or operator…"
                value={search.q ?? ""}
                onChange={(event) =>
                  patchSearch({ q: event.target.value || undefined, selected: undefined })
                }
              />
            </label>
            {activeView === "pipeline" ? (
              <label>
                Stage
                <select
                  name="pipeline-stage"
                  value={search.stage ?? "all"}
                  onChange={(event) =>
                    patchSearch({
                      stage: event.target.value as (typeof stages)[number],
                      selected: undefined,
                    })
                  }
                >
                  <option value="all">All Sites</option>
                  <option value="action_required">Action Required</option>
                  <option value="draft">Draft</option>
                  <option value="screening">Screening</option>
                  <option value="shortlisted">Candidate Shortlisted</option>
                  <option value="evidence_review">Evidence Review</option>
                  <option value="decision_ready">Decision Ready</option>
                </select>
              </label>
            ) : null}
            <label>
              Decision
              <select
                name="pipeline-decision"
                value={search.decision ?? "all"}
                onChange={(event) =>
                  patchSearch({
                    decision: event.target.value as (typeof decisions)[number],
                    selected: undefined,
                  })
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
              Sort
              <select
                name="pipeline-sort"
                value={search.sort ?? "priority"}
                onChange={(event) =>
                  patchSearch({
                    sort: event.target.value as "priority" | "updated" | "name" | "mw",
                  })
                }
              >
                <option value="priority">Decision Priority</option>
                <option value="updated">Recently Updated</option>
                <option value="mw">Required MW</option>
                <option value="name">Site Name</option>
              </select>
            </label>
            {activeView !== "pipeline" ? (
              <>
                <label>
                  Evidence Exposure
                  <select
                    name="portfolio-risk"
                    value={search.risk ?? "all"}
                    onChange={(event) =>
                      patchSearch({ risk: event.target.value as typeof search.risk })
                    }
                  >
                    <option value="all">All Sites</option>
                    <option value="blocked">Evidence Required</option>
                    <option value="deadline">Validity Deadline</option>
                    <option value="operator_confirmed">Operator Confirmed</option>
                  </select>
                </label>
                <label>
                  Operator
                  <select
                    name="portfolio-operator"
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
              </>
            ) : null}
            {filtersActive ? (
              <button
                type="button"
                className="rail-reset-button"
                onClick={() =>
                  void navigate({
                    to: "/portfolio",
                    search: { view: activeView },
                    replace: true,
                  })
                }
              >
                <X aria-hidden="true" /> Reset Filters
              </button>
            ) : null}
          </section>
          <details className="rail-section workspace-data-menu" suppressHydrationWarning>
            <summary>
              <Database aria-hidden="true" /> Workspace Data
            </summary>
            <div>
              <button
                type="button"
                onClick={() => patchSearch({ import: importOpen ? undefined : "open" })}
              >
                <FileUp aria-hidden="true" /> Import Sites
              </button>
              <button
                type="button"
                onClick={async () =>
                  downloadJson(await exportAnonymousWorkspace(), "gridpulse-workspace-backup.json")
                }
              >
                <Download aria-hidden="true" /> Export Backup
              </button>
              <button
                type="button"
                onClick={async () =>
                  downloadJson(
                    await exportAnonymousWorkspace(true),
                    "gridpulse-complete-portable-workspace.json",
                  )
                }
              >
                <Download aria-hidden="true" /> Complete Backup + Documents
              </button>
              <button
                type="button"
                disabled={!exportRows.length}
                onClick={() => void downloadPropertyXlsx(exportRows)}
              >
                <Download aria-hidden="true" /> Export Portfolio XLSX
              </button>
              <button
                type="button"
                disabled={!exportRows.length}
                onClick={() => downloadPortfolioComparisonPdf(exportRows)}
              >
                <Download aria-hidden="true" /> Portfolio Decision PDF
              </button>
              <button type="button" onClick={() => restoreInput.current?.click()}>
                <FileUp aria-hidden="true" /> Restore Backup
              </button>
              <input
                ref={restoreInput}
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const result = await restoreAnonymousWorkspace(JSON.parse(await file.text()));
                    toast.success(`${result.imported} sites restored`);
                  } catch (reason) {
                    toast.error(reason instanceof Error ? reason.message : "Restore failed");
                  }
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                className="danger-action"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Export a backup first if needed. Clear every locally stored site?",
                    )
                  )
                    return;
                  await clearAnonymousWorkspace();
                  toast.success("Local workspace cleared");
                }}
              >
                <Trash2 aria-hidden="true" /> Clear Workspace
              </button>
            </div>
          </details>
        </aside>
        <section className="decision-workspace-main">
          <header className="workspace-main-header">
            <div>
              <p className="context-label">Data-Centre Opportunity Portfolio</p>
              <h2>
                {activeView === "pipeline"
                  ? "Sites Under Review"
                  : activeView === "readiness"
                    ? "Portfolio Readiness"
                    : "Decision Review"}
              </h2>
              <p>
                {visible.length} of {summaries.length} sites shown
              </p>
              {summaries.length && filtersActive ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    void navigate({ to: "/portfolio", search: { view: activeView }, replace: true })
                  }
                >
                  Reset Portfolio View
                </button>
              ) : null}
            </div>
            <Link to="/power-finder" className="primary-button">
              <Plus aria-hidden="true" /> New Site Screening
            </Link>
          </header>
          <nav
            className="decision-view-switcher site-portfolio-view-switcher"
            aria-label="Sites portfolio view"
          >
            {portfolioViews.map((view) => (
              <button
                key={view}
                type="button"
                className={activeView === view ? "active" : ""}
                onClick={() => patchSearch({ view, selected: undefined })}
              >
                {view === "pipeline"
                  ? "Pipeline"
                  : view === "readiness"
                    ? "Readiness"
                    : "Decision Review"}
              </button>
            ))}
          </nav>
          {importOpen ? (
            <div className="workspace-inline-panel">
              <button
                className="panel-close"
                type="button"
                aria-label="Close import panel"
                onClick={() => patchSearch({ import: undefined })}
              >
                <X aria-hidden="true" />
              </button>
              <PropertyImportPanel
                variant="compact"
                onImported={() => {
                  void refresh();
                  patchSearch({ import: undefined });
                }}
              />
            </div>
          ) : null}
          {loading ? (
            <div className="decision-empty" role="status">
              <div className="loading-spinner" /> Loading local sites…
            </div>
          ) : error ? (
            <div className="decision-empty error-message" role="alert">
              {error}
            </div>
          ) : activeView === "readiness" ? (
            <PortfolioReadinessView sites={decisionSites} />
          ) : activeView === "decisions" ? (
            <PortfolioDecisionView
              intelligence={{
                ...intelligence,
                rows: intelligence.rows.filter((row) =>
                  decisionSites.some((site) => site.id === row.site_id),
                ),
              }}
              sites={decisionSites}
            />
          ) : !visible.length ? (
            <div className="decision-empty">
              <MapPin aria-hidden="true" />
              <h2>{summaries.length ? "No Sites Match This View" : "No Sites in the Pipeline"}</h2>
              <p>
                {summaries.length
                  ? "Clear filters or choose another portfolio stage."
                  : "Declare a site in Power Finder or import an existing opportunity."}
              </p>
              <Link to="/power-finder" className="primary-button">
                Screen a Site
              </Link>
            </div>
          ) : (
            <div className="site-queue">
              {visible.map((site) => (
                <Link
                  to="/portfolio"
                  search={{ ...search, selected: site.id }}
                  className={`site-queue-row${selected?.id === site.id ? " is-selected" : ""}`}
                  key={site.id}
                  aria-current={selected?.id === site.id ? "true" : undefined}
                >
                  <span className="site-identity">
                    <b>{site.name}</b>
                    <small>
                      {site.locationLabel} · {site.projectType.replaceAll("_", " ")}
                    </small>
                  </span>
                  <span>
                    <small>Required</small>
                    <b>{site.requiredMw.toLocaleString("en-GB")} MW</b>
                  </span>
                  <span>
                    <small>Stage</small>
                    <b>{stageLabel[site.stage]}</b>
                  </span>
                  <span>
                    <small>
                      {site.preferredCandidate ? "Shortlisted Candidate" : "Recommended"}
                    </small>
                    <b>
                      {site.preferredCandidate?.nodeName ??
                        site.recommendedCandidate?.nodeName ??
                        "Not screened"}
                    </b>
                    <em>
                      {(site.preferredCandidate ?? site.recommendedCandidate)
                        ? `${(site.preferredCandidate ?? site.recommendedCandidate)!.distanceKm.toFixed(1)} km · ${(site.preferredCandidate ?? site.recommendedCandidate)!.voltageKv.length ? `${Math.max(...(site.preferredCandidate ?? site.recommendedCandidate)!.voltageKv)} kV` : "Voltage unknown"}`
                        : "Open in Power Finder"}
                    </em>
                  </span>
                  <span>
                    <small>Evidence</small>
                    <b>{site.evidenceScore == null ? "Unknown" : `${site.evidenceScore}/100`}</b>
                    <em>
                      {site.checksRemaining.length}{" "}
                      {site.checksRemaining.length === 1 ? "check" : "checks"} remaining
                    </em>
                  </span>
                  <span className={`decision-chip is-${site.decisionStatus}`}>
                    {site.decisionStatus}
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </section>
        {selected ? (
          <SiteDetail
            site={selected}
            onClose={() => patchSearch({ selected: undefined })}
            onDeleted={async () => {
              await deleteAnonymousProperty(selected.id);
              patchSearch({ selected: undefined });
            }}
          />
        ) : null}
      </main>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SiteDetail({
  site,
  onClose,
  onDeleted,
}: {
  site: ReturnType<typeof projectAnonymousProperty>;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  return (
    <aside className="site-detail-panel" aria-label={`${site.name} details`}>
      <header>
        <div>
          <p className="context-label">Selected Site</p>
          <h2>{site.name}</h2>
          <p>{site.locationLabel}</p>
        </div>
        <button type="button" aria-label="Close site details" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="detail-status-line">
        <span className={`decision-chip is-${site.decisionStatus}`}>{site.decisionStatus}</span>
        <span>{stageLabel[site.stage]}</span>
        <span>{site.requiredMw} MW required</span>
      </div>
      <dl className="detail-location-summary">
        <div>
          <dt>Site label</dt>
          <dd>{site.property.siteLabel ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Municipality</dt>
          <dd>{site.property.municipality ?? "Not recorded"}</dd>
        </div>
      </dl>
      <section>
        <h3>Screening Snapshot</h3>
        <dl>
          <div>
            <dt>Public sources</dt>
            <dd>{site.property.enrichmentRuns?.[0]?.completedSources.length ?? 0} checked</dd>
          </div>
          <div>
            <dt>Grid candidates</dt>
            <dd>{site.candidateCount}</dd>
          </div>
          <div>
            <dt>Screening coverage</dt>
            <dd>{site.screeningCoverage}%</dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>{site.operator ?? "Unconfirmed"}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>
              {site.capacityState === "validated" ? "Validated evidence attached" : "Unknown"}
            </dd>
          </div>
          <div>
            <dt>Land control</dt>
            <dd>{site.property.landControlStatus}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>Recommended Connection Hypothesis</h3>
        <p>
          <b>{site.recommendedCandidate?.nodeName ?? "Not yet screened"}</b>
          {site.recommendedCandidate
            ? ` · ${site.recommendedCandidate.distanceKm.toFixed(1)} km · ${site.recommendedCandidate.screeningRank.toFixed(0)}/100 investigation score`
            : ""}
        </p>
        <small>Recommended for investigation—not a capacity offer.</small>
      </section>
      <section>
        <h3>Checks Before Decision</h3>
        <ul className="detail-blockers">
          {site.checksRemaining.slice(0, 6).map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
        <p className="next-action">
          <b>Recommended Next Step:</b> {site.nextAction}
        </p>
      </section>
      <section className="site-decision-form detail-decision-summary">
        <h3>Client Decision</h3>
        <div className="detail-decision-current">
          <span className={`decision-chip is-${site.decisionStatus}`}>{site.decisionStatus}</span>
          <p>{site.property.decisionRationale ?? "No rationale recorded yet."}</p>
        </div>
        <Link
          className="primary-button"
          to="/portfolio/$id"
          params={{ id: site.id }}
          search={{ tab: "decision" }}
        >
          Review Decision
        </Link>
      </section>
      <footer>
        <Link
          to="/power-finder"
          search={{
            propertyId: site.id,
            lat: site.property.project.latitude ?? undefined,
            lng: site.property.project.longitude ?? undefined,
            mw: site.property.project.importMw,
            projectType: site.property.project.type,
            voltage: suggestScreeningVoltage(
              site.property.project.importMw,
              site.property.project.type,
              site.property.project.preferredVoltageKv,
            ),
            preferredVoltage: suggestScreeningVoltage(
              site.property.project.importMw,
              site.property.project.type,
              site.property.project.preferredVoltageKv,
            ),
          }}
        >
          Review in Power Finder
        </Link>
        <Link to="/portfolio/$id" params={{ id: site.id }} search={{ tab: "overview" }}>
          Open Site Workspace
        </Link>
        <Link to="/capacity-dossiers/$id" params={{ id: site.id }}>
          Export Record
        </Link>
        <button
          type="button"
          className="danger-action"
          onClick={async () => {
            if (!window.confirm(`Delete ${site.name} from this browser?`)) return;
            await onDeleted();
          }}
        >
          <Trash2 /> Delete
        </button>
      </footer>
    </aside>
  );
}
