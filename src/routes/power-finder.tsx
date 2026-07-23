import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  Database,
  ExternalLink,
  Factory,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/product/AppShell";
import { PowerFinderMap } from "@/components/product/PowerFinderMap";
import {
  featureSummary,
  pointCoordinates,
  type PowerFinderCollection,
  type PowerFinderFeature,
  type PowerFinderKind,
} from "@/features/power-finder/fixture-data";
import {
  loadPowerFinderViewport,
  type PowerFinderBounds,
} from "@/features/power-finder/data-source";
import { scoreFeature } from "@/features/power-finder/screening-score";
import { savePowerFinderCandidate } from "@/features/power-finder/shortlist";
import {
  loadOperatorEvidence,
  type OperatorEvidenceResult,
} from "@/features/power-finder/operator-evidence";

export const Route = createFileRoute("/power-finder")({
  head: () => ({
    meta: [{ title: "Power Finder | GridPulse" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PowerFinderPage,
});

const kindLabels: Record<PowerFinderKind, string> = {
  node: "Grid nodes",
  line: "Grid lines",
  industrial_site: "Industrial sites",
  generation_asset: "Registered generation",
  storage_asset: "Registered storage",
};
const initialBounds: PowerFinderBounds = {
  west: 12.9,
  south: 52.1,
  east: 13.8,
  north: 52.6,
};
type CandidateSort = "context" | "voltage" | "name";

function PowerFinderPage() {
  const navigate = useNavigate();
  const [collection, setCollection] = useState<PowerFinderCollection | null>(null);
  const [selected, setSelected] = useState<PowerFinderFeature | null>(null);
  const [enabled, setEnabled] = useState<Record<PowerFinderKind, boolean>>({
    node: true,
    line: true,
    industrial_site: true,
    generation_asset: false,
    storage_asset: false,
  });
  const [error, setError] = useState("");
  const [bounds, setBounds] = useState(initialBounds);
  const [dataMode, setDataMode] = useState<"database" | "published_artifact" | null>(null);
  const [query, setQuery] = useState("");
  const [minimumVoltage, setMinimumVoltage] = useState(0);
  const [operator, setOperator] = useState("all");
  const [candidateSort, setCandidateSort] = useState<CandidateSort>("context");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shortlistId, setShortlistId] = useState<string | null>(null);
  const [operatorEvidence, setOperatorEvidence] = useState<OperatorEvidenceResult | null>(null);
  const [operatorEvidenceState, setOperatorEvidenceState] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadPowerFinderViewport(bounds, controller.signal)
        .then(({ collection: nextCollection, mode }) => {
          setCollection(nextCollection);
          setDataMode(mode);
          setError("");
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(
              reason instanceof Error ? reason.message : "Power Finder data failed to load.",
            );
          }
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [bounds]);

  const visibleCollection = useMemo<PowerFinderCollection | null>(() => {
    if (!collection) return null;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const features = collection.features.filter((feature) => {
      const properties = feature.properties;
      const voltage = Math.max(0, ...(properties.voltage_kv ?? []));
      const matchesQuery =
        !normalizedQuery ||
        properties.name.toLocaleLowerCase().includes(normalizedQuery) ||
        properties.operator?.toLocaleLowerCase().includes(normalizedQuery) ||
        feature.id.toLocaleLowerCase().includes(normalizedQuery);
      const matchesVoltage =
        properties.kind !== "node" || minimumVoltage === 0 || voltage >= minimumVoltage;
      const matchesOperator = operator === "all" || properties.operator === operator;
      return enabled[properties.kind] && matchesQuery && matchesVoltage && matchesOperator;
    });
    return {
      ...collection,
      features,
      metadata: { ...collection.metadata, record_count: features.length },
    };
  }, [collection, enabled, minimumVoltage, operator, query]);

  const operators = useMemo(
    () =>
      Array.from(
        new Set(
          collection?.features
            .map((feature) => feature.properties.operator)
            .filter((value): value is string => Boolean(value)) ?? [],
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [collection],
  );

  const candidates = useMemo(() => {
    const items =
      visibleCollection?.features.filter(
        (feature) =>
          feature.properties.kind === "node" || feature.properties.kind === "industrial_site",
      ) ?? [];
    return items
      .sort((left, right) => {
        if (candidateSort === "name") {
          return left.properties.name.localeCompare(right.properties.name);
        }
        if (candidateSort === "voltage") {
          return (
            Math.max(0, ...(right.properties.voltage_kv ?? [])) -
            Math.max(0, ...(left.properties.voltage_kv ?? []))
          );
        }
        return (scoreFeature(right)?.total ?? -1) - (scoreFeature(left)?.total ?? -1);
      })
      .slice(0, 100);
  }, [candidateSort, visibleCollection]);
  const coordinates = selected ? pointCoordinates(selected) : null;
  const score = selected ? scoreFeature(selected) : null;

  useEffect(() => {
    setSaveStatus("idle");
    setShortlistId(null);
  }, [selected?.id]);

  useEffect(() => {
    setOperatorEvidence(null);
    if (!selected || selected.properties.kind !== "node" || dataMode !== "database") {
      setOperatorEvidenceState("idle");
      return;
    }
    const controller = new AbortController();
    setOperatorEvidenceState("loading");
    void loadOperatorEvidence(selected.id, controller.signal)
      .then((result) => {
        setOperatorEvidence(result);
        setOperatorEvidenceState("ready");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("Operator evidence could not be loaded.", reason);
          setOperatorEvidenceState("unavailable");
        }
      });
    return () => controller.abort();
  }, [dataMode, selected]);

  return (
    <AppShell requireAuth>
      <main id="main-content" className="power-finder-page">
        <section className="power-finder-sidebar" aria-label="Power Finder controls">
          <header>
            <p className="context-label">Power Finder · Public-source screen</p>
            <h1>Brandenburg connection context</h1>
            <p>
              Explore grid proximity and industrial land, then move a candidate into the
              evidence-led connection workflow.
            </p>
          </header>

          <aside className="power-finder-boundary">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Screening context—not a connection offer</strong>
              <p>Unknown MW, responsibility, feasibility, cost, and dates remain unknown.</p>
            </div>
          </aside>

          <section className="power-finder-filter-panel" aria-label="Search and filter map">
            <label className="power-finder-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search nodes, operators, or identifiers</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search node, operator, or ID"
              />
            </label>
            <div className="power-finder-filter-grid">
              <label>
                <span>Minimum voltage</span>
                <select
                  value={minimumVoltage}
                  onChange={(event) => setMinimumVoltage(Number(event.target.value))}
                >
                  <option value={0}>Any / unknown</option>
                  <option value={20}>20+ kV</option>
                  <option value={110}>110+ kV</option>
                  <option value={220}>220+ kV</option>
                  <option value={380}>380+ kV</option>
                </select>
              </label>
              <label>
                <span>Operator</span>
                <select value={operator} onChange={(event) => setOperator(event.target.value)}>
                  <option value="all">All operators</option>
                  {operators.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section>
            <h2>Layers</h2>
            <div className="power-finder-layer-list">
              {(Object.keys(kindLabels) as PowerFinderKind[]).map((kind) => (
                <label key={kind}>
                  <input
                    type="checkbox"
                    checked={enabled[kind]}
                    onChange={(event) =>
                      setEnabled((current) => ({ ...current, [kind]: event.target.checked }))
                    }
                  />
                  <span>{kindLabels[kind]}</span>
                  <small>
                    {collection?.features.filter((feature) => feature.properties.kind === kind)
                      .length ?? "—"}
                  </small>
                </label>
              ))}
            </div>
          </section>

          <section className="power-finder-candidates">
            <header>
              <span>
                <h2>Candidate context</h2>
                <small>
                  Showing {candidates.length}
                  {(visibleCollection?.features.length ?? 0) > 100 ? " of top 100" : ""}
                </small>
              </span>
              <label>
                <span className="sr-only">Sort candidates</span>
                <select
                  value={candidateSort}
                  onChange={(event) => setCandidateSort(event.target.value as CandidateSort)}
                >
                  <option value="context">Best context</option>
                  <option value="voltage">Highest voltage</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </header>
            {candidates.length === 0 && (
              <p className="power-finder-no-results">No candidates match these filters.</p>
            )}
            {candidates.map((feature) => (
              <button
                key={feature.id}
                className={selected?.id === feature.id ? "active" : ""}
                onClick={() => setSelected(feature)}
              >
                {feature.properties.kind === "node" ? <Zap /> : <Factory />}
                <span>
                  <b>{feature.properties.name}</b>
                  <small>{featureSummary(feature)}</small>
                </span>
              </button>
            ))}
          </section>

          {collection && (
            <footer className="power-finder-source">
              <Database aria-hidden="true" />
              <div>
                <strong>{collection.metadata.publisher}</strong>
                <span>
                  {collection.metadata.freshness} · {collection.metadata.record_count} records ·{" "}
                  {dataMode === "database" ? "bounded database query" : "accepted static release"}
                </span>
                <small>{collection.metadata.attribution}</small>
              </div>
            </footer>
          )}
        </section>

        <section className="power-finder-stage">
          {error && <div className="power-finder-error">{error}</div>}
          {!visibleCollection && !error && (
            <div className="power-finder-loading">Loading map context…</div>
          )}
          {visibleCollection && (
            <PowerFinderMap
              collection={visibleCollection}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onViewportChange={setBounds}
            />
          )}

          <div className="power-finder-legend" aria-label="Map legend">
            <strong>Screening context</strong>
            <span>
              <i className="legend-node" /> Candidate grid node
            </span>
            <span>
              <i className="legend-line" /> Mapped corridor
            </span>
            <span>
              <i className="legend-site" /> Industrial land
            </span>
            <span>
              <i className="legend-generation" /> Registered generation
            </span>
            <span>
              <i className="legend-storage" /> Registered storage
            </span>
          </div>

          <aside className={`power-finder-detail ${selected ? "open" : ""}`}>
            {selected ? (
              <>
                <button
                  className="detail-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close detail"
                >
                  ×
                </button>
                <p className="context-label">{kindLabels[selected.properties.kind]}</p>
                <h2>{selected.properties.name}</h2>
                <p>{featureSummary(selected)}</p>
                <dl>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{selected.properties.evidence_class.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Operator</dt>
                    <dd>{selected.properties.operator ?? "Confirmation required"}</dd>
                  </div>
                  <div>
                    <dt>Capacity</dt>
                    <dd
                      className={
                        selected.properties.capacity_state === "published_exact" ||
                        selected.properties.capacity_state === "published_band"
                          ? ""
                          : "is-warning"
                      }
                    >
                      {selected.properties.capacity_state === "published_exact"
                        ? `${selected.properties.exact_mw} MW published`
                        : selected.properties.capacity_state === "published_band"
                          ? `${selected.properties.band_min_mw}–${selected.properties.band_max_mw ?? "?"} MW published band`
                          : "Not established"}
                    </dd>
                  </div>
                  <div>
                    <dt>Planning status</dt>
                    <dd>{selected.properties.planning_status ?? "Not established"}</dd>
                  </div>
                </dl>
                {score && (
                  <section className="power-finder-score" aria-label="Screening context score">
                    <header>
                      <span>
                        <strong>{score.total}/100</strong>
                        <small>{score.label}</small>
                      </span>
                      <b>Context score</b>
                    </header>
                    <ul>
                      {score.components.map((component) => (
                        <li key={component.label} title={component.reason}>
                          <span>{component.label}</span>
                          <b>
                            {component.points}/{component.maximum}
                          </b>
                        </li>
                      ))}
                    </ul>
                    <p>{score.boundary}</p>
                  </section>
                )}
                {selected.properties.kind === "node" && (
                  <section
                    className="power-finder-operator-evidence"
                    aria-label="Official operator evidence"
                  >
                    <header>
                      <ShieldCheck aria-hidden="true" />
                      <span>
                        <b>Operator evidence</b>
                        <small>
                          {operatorEvidence?.match_state === "accepted_node_evidence"
                            ? "Reviewed node match"
                            : operatorEvidence?.match_state === "operator_context_only"
                              ? "Operator-level context"
                              : "No reviewed node evidence"}
                        </small>
                      </span>
                    </header>
                    {operatorEvidenceState === "loading" && <p>Checking accepted evidence…</p>}
                    {operatorEvidenceState === "unavailable" && (
                      <p>Evidence service is temporarily unavailable.</p>
                    )}
                    {operatorEvidenceState === "idle" && dataMode === "published_artifact" && (
                      <p>Sign in to the live evidence release to inspect operator sources.</p>
                    )}
                    {operatorEvidenceState === "ready" &&
                      (operatorEvidence?.items.length ? (
                        <ul>
                          {operatorEvidence.items.map((item) => (
                            <li key={`${item.scope}-${item.url}`}>
                              <span>
                                {item.scope === "node_match" && (
                                  <CheckCircle2 aria-label="Reviewed node match" />
                                )}
                                <a href={item.url} target="_blank" rel="noreferrer">
                                  {item.title} <ExternalLink aria-hidden="true" />
                                </a>
                              </span>
                              <small>
                                {item.scope === "node_match" ? item.rationale : item.legal_boundary}
                              </small>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          No official publication is linked to this mapped node. Capacity remains
                          unknown until the responsible operator responds.
                        </p>
                      ))}
                    <footer>
                      Operator-level pages explain process or network context. They do not establish
                      capacity at this node.
                    </footer>
                  </section>
                )}
                {coordinates && (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={saveStatus === "saving"}
                    onClick={() => {
                      setSaveStatus("saving");
                      void savePowerFinderCandidate(selected)
                        .then((id) => {
                          setShortlistId(id);
                          setSaveStatus("saved");
                          return navigate({
                            to: "/assessments/new",
                            search: {
                              shortlistId: id,
                              name: selected.properties.name,
                              projectType: "large_load",
                              latitude: coordinates[1],
                              longitude: coordinates[0],
                              federalState: "Brandenburg",
                              challenge: `Screening candidate ${selected.id}; capacity and operator responsibility require confirmation.`,
                            },
                          });
                        })
                        .catch(() => setSaveStatus("error"));
                    }}
                  >
                    <MapPin />{" "}
                    {saveStatus === "saving" ? "Saving map context…" : "Start private assessment"}
                  </button>
                )}
                {["node", "industrial_site"].includes(selected.properties.kind) && (
                  <button
                    type="button"
                    className="secondary-button power-finder-save"
                    disabled={saveStatus === "saving" || saveStatus === "saved"}
                    onClick={() => {
                      setSaveStatus("saving");
                      void savePowerFinderCandidate(selected)
                        .then((id) => {
                          setShortlistId(id);
                          setSaveStatus("saved");
                        })
                        .catch(() => setSaveStatus("error"));
                    }}
                  >
                    <BookmarkPlus aria-hidden="true" />
                    {saveStatus === "saving"
                      ? "Saving…"
                      : saveStatus === "saved"
                        ? "Saved to shortlist"
                        : saveStatus === "error"
                          ? "Try saving again"
                          : shortlistId
                            ? "Saved to shortlist"
                            : "Save candidate"}
                  </button>
                )}
                {!coordinates && (
                  <p className="detail-help">
                    Select a node to start an assessment. Industrial land remains site context only.
                  </p>
                )}
                <Link to="/data-sources" className="power-finder-method-link">
                  Review evidence methodology <ExternalLink />
                </Link>
              </>
            ) : (
              <div className="power-finder-empty-detail">
                <Network />
                <h2>Select a node or site</h2>
                <p>Inspect its source boundary and move a node into a private assessment.</p>
              </div>
            )}
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
