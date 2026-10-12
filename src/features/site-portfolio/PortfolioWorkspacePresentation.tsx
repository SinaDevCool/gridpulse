import { AppShell } from "@/components/product/AppShell";
import { deleteAnonymousProperty } from "@/features/anonymous-workspace/repository";
import { PropertyImportPanel } from "@/features/properties/PropertyImportPanel";
import {
  PortfolioDecisionView,
  PortfolioReadinessView,
} from "@/features/site-portfolio/PortfolioViews";
import { portfolioViews } from "@/features/site-portfolio/portfolio-status";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Plus, X } from "lucide-react";
import { PortfolioWorkspaceControls } from "./PortfolioWorkspaceControls";
import { SiteDetail } from "./portfolio-primitives";
import { stageLabel } from "./workspace-export";
import type { PortfolioWorkspaceContract } from "./workspace-contract";
export function PortfolioWorkspacePresentation({ model }: { model: PortfolioWorkspaceContract }) {
  const {
    navigate,
    search,
    restoreInput,
    summaries,
    loading,
    error,
    refresh,
    metrics,
    selected,
    activeView,
    importOpen,
    visible,
    patchSearch,
    intelligence,
    decisionSites,
    exportRows,
    filtersActive,
  } = model;
  return (
    <AppShell>
      <main id="main-content" className="site-pipeline-page decision-workspace-page">
        <PortfolioWorkspaceControls model={model} />
        <section className="decision-workspace-main">
          <header className="workspace-main-header">
            <div>
              <p className="context-label">Data-Centre Opportunity Portfolio</p>
              <h2>
                {activeView === "pipeline"
                  ? "Sites Under Review"
                  : activeView === "readiness"
                    ? "Property Comparison"
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
                    ? "Comparison"
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
