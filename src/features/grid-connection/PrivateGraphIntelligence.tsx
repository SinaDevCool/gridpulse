import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  History,
  Network,
  Route,
  ShieldCheck,
} from "lucide-react";
import {
  graphSafetyBoundary,
  loadPrivateGraphWorkspace,
  privateGraphStateLabels,
  type PrivateGraphWorkspace,
} from "./private-graph-workspace";

type Tab = "overview" | "pathways" | "scenarios" | "evidence" | "audit";

const PrivatePathwayGraph = lazy(() => import("./PrivatePathwayGraph"));

const number = (value: unknown) => (typeof value === "number" ? value : null);
const text = (value: unknown) => (typeof value === "string" ? value : "—");
const bool = (value: unknown) => (value === true ? "Pass" : value === false ? "Fail" : "Unknown");
const compactHash = (value: unknown) => {
  const hash = text(value);
  return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
};
const date = (value: unknown) => {
  if (typeof value !== "string" || !value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        parsed,
      );
};

function EmptyGraphState({ graph }: { graph: PrivateGraphWorkspace }) {
  const noWorkspace = graph.state === "no_workspace";
  return (
    <section className="private-graph-empty" aria-live="polite">
      <Network aria-hidden="true" />
      <div>
        <span className="eyebrow">Private topology intelligence</span>
        <h3>{privateGraphStateLabels[graph.state]}</h3>
        <p>
          {noWorkspace
            ? "Create an operator pilot workspace before importing restricted network data."
            : "Import and accept a versioned electrical model to calculate topology pathways and candidate-relevant scenarios."}
        </p>
        <small>{graphSafetyBoundary}</small>
      </div>
    </section>
  );
}

function AuditTimeline({ rows }: { rows: Array<Record<string, unknown>> }) {
  const parent = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 66,
    overscan: 6,
    useFlushSync: false,
  });
  return (
    <div
      className="private-graph-timeline"
      ref={parent}
      tabIndex={0}
      aria-label="Graph audit events"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          return (
            <article
              key={`${row.sequence ?? item.index}`}
              style={{
                transform: `translateY(${item.start}px)`,
                position: "absolute",
                width: "100%",
              }}
            >
              <History aria-hidden="true" />
              <span>
                <b>{text(row.event_type)}</b>
                <small>
                  {text(row.asset_id)} · {date(row.occurred_at)}
                </small>
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function PrivateGraphIntelligence({ siteId }: { siteId: string }) {
  const [graph, setGraph] = useState<PrivateGraphWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [pathIndex, setPathIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    void loadPrivateGraphWorkspace(siteId)
      .then((value) => active && setGraph(value))
      .catch(
        (reason) =>
          active &&
          setError(reason instanceof Error ? reason.message : "Graph workspace unavailable"),
      );
    return () => {
      active = false;
    };
  }, [siteId]);

  const pathways = graph?.pathways?.pathways ?? [];
  const selectedPath = pathways[Math.min(pathIndex, Math.max(pathways.length - 1, 0))];
  const topology = graph?.topology_audit ?? {};
  const scenarios = graph?.scenario_coverage ?? {};
  const quality = graph?.quality ?? {};
  const metrics = (quality.metrics ?? {}) as Record<string, unknown>;
  const checks = (quality.checks ?? {}) as Record<string, unknown>;
  const portfolio = graph?.portfolio ?? {};
  const interactions = useMemo(
    () =>
      Array.isArray(portfolio.pairwise_interactions)
        ? (portfolio.pairwise_interactions as Array<Record<string, unknown>>)
        : [],
    [portfolio],
  );

  if (error) {
    return (
      <section className="private-graph-empty is-error" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          <h3>Graph workspace unavailable</h3>
          <p>{error}</p>
        </div>
      </section>
    );
  }
  if (!graph)
    return (
      <section className="private-graph-empty" aria-live="polite">
        <Database aria-hidden="true" />
        <p>Loading graph workspace…</p>
      </section>
    );
  if (!graph.model) return <EmptyGraphState graph={graph} />;

  return (
    <section className="private-graph" aria-labelledby="private-graph-title">
      <header className="private-graph-header">
        <div>
          <span className="eyebrow">Private topology intelligence</span>
          <h3 id="private-graph-title">{graph.model.model_id}</h3>
          <p>
            {graph.model.model_version} · {privateGraphStateLabels[graph.state]}
          </p>
        </div>
        <span className={`graph-validation graph-state-${graph.state}`}>
          {graph.workspace?.validation_class.replaceAll("_", " ")}
        </span>
      </header>

      {graph.state === "stale" && (
        <div className="private-graph-warning" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>
            <b>Results are stale</b>
            <small>
              The graph projection changed. Re-run affected physics scenarios before using these
              results.
            </small>
          </span>
        </div>
      )}

      <nav className="private-graph-tabs" aria-label="Topology intelligence views">
        {(["overview", "pathways", "scenarios", "evidence", "audit"] as Tab[]).map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? "active" : ""}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="private-graph-view">
          <div className="private-graph-metrics">
            <article>
              <Route />
              <span>Alternative pathways</span>
              <strong>{pathways.length}</strong>
            </article>
            <article>
              <GitBranch />
              <span>Bridge assets</span>
              <strong>
                {Array.isArray(topology.bridge_assets) ? topology.bridge_assets.length : 0}
              </strong>
            </article>
            <article>
              <Network />
              <span>Connected components</span>
              <strong>
                {Array.isArray(topology.connected_components)
                  ? topology.connected_components.length
                  : "—"}
              </strong>
            </article>
            <article>
              <ShieldCheck />
              <span>Physics linkage</span>
              <strong>
                {graph.state === "physics_verified"
                  ? "Verified"
                  : graph.state === "stale"
                    ? "Stale"
                    : "Pending"}
              </strong>
            </article>
          </div>
          <dl className="private-graph-facts">
            <div>
              <dt>Projection</dt>
              <dd title={graph.model.projection_sha256}>
                {compactHash(graph.model.projection_sha256)}
              </dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{date(graph.model.created_at)}</dd>
            </div>
            <div>
              <dt>Pathfinding ready</dt>
              <dd>{bool(topology.accepted_for_pathfinding)}</dd>
            </div>
            <div>
              <dt>Physics ready</dt>
              <dd>{bool(topology.accepted_for_physics)}</dd>
            </div>
          </dl>
          <p className="private-graph-boundary">{graphSafetyBoundary}</p>
        </div>
      )}

      {tab === "pathways" && (
        <div className="private-graph-view pathway-view">
          {pathways.length ? (
            <>
              <div
                className="pathway-switcher"
                role="list"
                aria-label="Alternative network pathways"
              >
                {pathways.map((path, index) => (
                  <button
                    type="button"
                    role="listitem"
                    className={index === pathIndex ? "active" : ""}
                    onClick={() => setPathIndex(index)}
                    key={`${path.rank}-${path.target_bus}`}
                  >
                    <b>{index === 0 ? "Lowest investigation cost" : `Alternative ${index + 1}`}</b>
                    <span>
                      {path.asset_ids.length} assets · cost {path.total_graph_cost}
                    </span>
                  </button>
                ))}
              </div>
              {selectedPath && (
                <Suspense
                  fallback={
                    <div className="private-graph-canvas is-loading">Loading bounded graph…</div>
                  }
                >
                  <PrivatePathwayGraph pathway={selectedPath} />
                </Suspense>
              )}
              {selectedPath && (
                <div className="table-wrap">
                  <table>
                    <caption>Ordered pathway assets</caption>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Asset</th>
                        <th>From bus</th>
                        <th>To bus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPath.asset_ids.map((asset, index) => (
                        <tr key={asset}>
                          <td>{index + 1}</td>
                          <td>{asset}</td>
                          <td>{selectedPath.bus_ids[index] ?? "—"}</td>
                          <td>{selectedPath.bus_ids[index + 1] ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p>No bounded alternative pathways were published for this graph study.</p>
          )}
        </div>
      )}

      {tab === "scenarios" && (
        <div className="private-graph-view">
          <div className="private-graph-metrics">
            <article>
              <Database />
              <span>Candidate cases</span>
              <strong>{number(scenarios.candidate_count) ?? "—"}</strong>
            </article>
            <article>
              <CheckCircle2 />
              <span>Selected cases</span>
              <strong>{number(scenarios.selected_count) ?? "—"}</strong>
            </article>
            <article>
              <ShieldCheck />
              <span>Mandatory preserved</span>
              <strong>{bool(scenarios.operator_mandatory_cases_preserved)}</strong>
            </article>
            <article>
              <GitBranch />
              <span>Reduction gate</span>
              <strong>{bool(scenarios.safe_for_prioritisation)}</strong>
            </article>
          </div>
          <dl className="private-graph-facts">
            <div>
              <dt>Infeasible-case recall</dt>
              <dd>
                {number(scenarios.infeasible_recall) != null
                  ? `${Math.round(Number(scenarios.infeasible_recall) * 100)}%`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Constraint recall</dt>
              <dd>
                {number(scenarios.constraint_recall) != null
                  ? `${Math.round(Number(scenarios.constraint_recall) * 100)}%`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Reduction</dt>
              <dd>
                {number(scenarios.reduction_fraction) != null
                  ? `${Math.round(Number(scenarios.reduction_fraction) * 100)}%`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Physics attachments</dt>
              <dd>{graph.physics?.length ?? 0}</dd>
            </div>
          </dl>
          <section className="private-graph-constraints">
            <h4>Verified constraints</h4>
            {(graph.physics ?? [])
              .flatMap((item) => {
                const payload =
                  item.payload && typeof item.payload === "object"
                    ? (item.payload as Record<string, unknown>)
                    : {};
                return Array.isArray(payload.outcomes)
                  ? (payload.outcomes as Array<Record<string, unknown>>)
                  : [];
              })
              .map((outcome, index) => (
                <article key={`${outcome.scenario_id ?? index}`}>
                  <span>
                    <b>{text(outcome.scenario_id)}</b>
                    <small>{text(outcome.binding_constraint)}</small>
                  </span>
                  <strong>{text(outcome.status)}</strong>
                </article>
              ))}
          </section>
        </div>
      )}

      {tab === "evidence" && (
        <div className="private-graph-view">
          <section className="quality-gate">
            <header>
              <ShieldCheck />
              <div>
                <h4>Operational quality gate</h4>
                <p>{quality.accepted === true ? "Accepted" : "Review required"}</p>
              </div>
            </header>
            <dl className="private-graph-facts">
              <div>
                <dt>Parameter completeness</dt>
                <dd>
                  {number(metrics.parameter_completeness) != null
                    ? `${Math.round(Number(metrics.parameter_completeness) * 100)}% · ${bool(checks.parameter_completeness)}`
                    : "Not measured"}
                </dd>
              </div>
              <div>
                <dt>Orphan ratio</dt>
                <dd>
                  {number(metrics.orphan_ratio) != null
                    ? `${metrics.orphan_ratio} · ${bool(checks.orphan_ratio)}`
                    : "Not measured"}
                </dd>
              </div>
              <div>
                <dt>Voltage MAE</dt>
                <dd>
                  {number(metrics.voltage_mae_pu) != null
                    ? `${metrics.voltage_mae_pu} p.u. · ${bool(checks.voltage_mae)}`
                    : "Not measured"}
                </dd>
              </div>
              <div>
                <dt>Active-power MAE</dt>
                <dd>
                  {number(metrics.active_power_mae_mw) != null
                    ? `${metrics.active_power_mae_mw} MW · ${bool(checks.active_power_mae)}`
                    : "Not measured"}
                </dd>
              </div>
              <div>
                <dt>Observation coverage</dt>
                <dd>
                  {number(metrics.observation_coverage) != null
                    ? `${Math.round(Number(metrics.observation_coverage) * 100)}% · ${bool(checks.observation_coverage)}`
                    : "Not measured"}
                </dd>
              </div>
            </dl>
          </section>
          <section className="sovereignty-card">
            <header>
              <ShieldCheck />
              <div>
                <h4>Workspace data policy</h4>
                <p>{graph.policy?.active === true ? "Active" : "Not configured"}</p>
              </div>
            </header>
            <dl className="private-graph-facts">
              <div>
                <dt>Regions</dt>
                <dd>
                  {Array.isArray(graph.policy?.permitted_regions)
                    ? graph.policy?.permitted_regions.join(", ")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Purposes</dt>
                <dd>
                  {Array.isArray(graph.policy?.purposes) ? graph.policy?.purposes.join(", ") : "—"}
                </dd>
              </div>
              <div>
                <dt>Retention</dt>
                <dd>
                  {number(graph.policy?.retention_days) != null
                    ? `${graph.policy?.retention_days} days`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Raw export</dt>
                <dd>
                  {graph.policy?.allow_raw_export === true ? "Permitted by policy" : "Redacted"}
                </dd>
              </div>
              <div>
                <dt>Model training</dt>
                <dd>
                  {graph.policy?.allow_model_training === true
                    ? "Permitted by policy"
                    : "Not permitted"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {tab === "audit" && (
        <div className="private-graph-view">
          <dl className="private-graph-facts">
            <div>
              <dt>Study hash</dt>
              <dd title={graph.model.study_sha256}>{compactHash(graph.model.study_sha256)}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>{graph.schema_version}</dd>
            </div>
            <div>
              <dt>Snapshots</dt>
              <dd>{graph.history?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Deltas</dt>
              <dd>{graph.deltas?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Portfolio pairs</dt>
              <dd>{interactions.length}</dd>
            </div>
          </dl>
          <h4>Topology events</h4>
          {(graph.events?.length ?? 0) > 0 ? (
            <AuditTimeline rows={graph.events ?? []} />
          ) : (
            <p>No topology events are attached to this model version.</p>
          )}
          <h4>Portfolio topology exposure</h4>
          {interactions.length ? (
            interactions.map((item, index) => (
              <article className="portfolio-overlap-row" key={index}>
                <b>
                  {text(item.candidate_a)} ↔ {text(item.candidate_b)}
                </b>
                <span>
                  {number(item.topology_overlap) != null
                    ? `${Math.round(Number(item.topology_overlap) * 100)}% shared topology`
                    : "—"}
                </span>
                <small>
                  {item.path_diverse === true ? "Path-diverse" : "Shared upstream exposure"}
                </small>
              </article>
            ))
          ) : (
            <p>
              No portfolio interaction study is attached. These metrics describe shared topology,
              not simultaneous capacity.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
