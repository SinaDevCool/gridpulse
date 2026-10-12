import {
  clearAnonymousWorkspace,
  exportAnonymousWorkspace,
  restoreAnonymousWorkspace,
} from "@/features/anonymous-workspace/repository";
import { downloadPortfolioComparisonPdf } from "@/features/properties/capacity-dossier";
import { downloadPropertyXlsx } from "@/features/properties/property-export";
import { portfolioDecisions, portfolioStages } from "@/features/site-portfolio/portfolio-status";
import { Database, Download, FileUp, Filter, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Metric } from "./portfolio-primitives";
import { downloadJson } from "./workspace-export";
import type { PortfolioWorkspaceContract } from "./workspace-contract";
export function PortfolioWorkspaceControls({ model }: { model: PortfolioWorkspaceContract }) {
  const {
    navigate,
    search,
    restoreInput,
    error,
    metrics,
    selected,
    activeView,
    importOpen,
    patchSearch,
    intelligence,
    exportRows,
    filtersActive,
  } = model;
  return (
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
                  stage: event.target.value as (typeof portfolioStages)[number],
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
                decision: event.target.value as (typeof portfolioDecisions)[number],
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
          <div className="workspace-data-group">
            <span>Bring Data In</span>
            <button
              type="button"
              onClick={() => patchSearch({ import: importOpen ? undefined : "open" })}
            >
              <FileUp aria-hidden="true" /> <strong>Import Sites</strong>
            </button>
            <button type="button" onClick={() => restoreInput.current?.click()}>
              <FileUp aria-hidden="true" /> <strong>Restore Backup</strong>
            </button>
          </div>
          <div className="workspace-data-group">
            <span>Export &amp; Share</span>
            <button
              type="button"
              onClick={async () =>
                downloadJson(await exportAnonymousWorkspace(), "gridpulse-workspace-backup.json")
              }
            >
              <Download aria-hidden="true" /> <strong>Workspace Backup</strong>
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
              <Download aria-hidden="true" /> <strong>Backup With Documents</strong>
            </button>
            <button
              type="button"
              disabled={!exportRows.length}
              onClick={() => void downloadPropertyXlsx(exportRows)}
            >
              <Download aria-hidden="true" /> <strong>Portfolio XLSX</strong>
            </button>
            <button
              type="button"
              disabled={!exportRows.length}
              onClick={() => downloadPortfolioComparisonPdf(exportRows)}
            >
              <Download aria-hidden="true" /> <strong>Decision PDF</strong>
            </button>
          </div>
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
                !window.confirm("Export a backup first if needed. Clear every locally stored site?")
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
  );
}
