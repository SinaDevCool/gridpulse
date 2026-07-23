import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  GitCompareArrows,
  Database,
  ExternalLink,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
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
import {
  candidateEvidenceBoundary,
  opportunityNode,
  type CandidateOpportunity,
  type RankedCandidateResult,
} from "@/features/power-finder/candidate-intelligence";
import { loadRankedCandidates } from "@/features/power-finder/ranked-candidates";

export const Route = createFileRoute("/power-finder")({
  validateSearch: z.object({
    q: z.string().max(160).optional(),
    voltage: z.coerce
      .number()
      .refine((value) => [0, 20, 110, 220, 380].includes(value))
      .optional(),
    operator: z.string().max(160).optional(),
    sort: z.enum(["context", "voltage", "name"]).optional(),
    mw: z.coerce.number().min(0.1).max(1000).optional(),
    distance: z.coerce.number().min(1).max(100).optional(),
    candidate: z.string().max(200).optional(),
    compare: z.string().max(700).optional(),
  }),
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
const distanceFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

function PowerFinderPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
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
  const query = search.q ?? "";
  const minimumVoltage = search.voltage ?? 0;
  const operator = search.operator ?? "all";
  const candidateSort: CandidateSort = search.sort ?? "context";
  const requiredImportMw = search.mw ?? 100;
  const maxDistanceKm = search.distance ?? 20;
  const updateSearch = (patch: Partial<typeof search>) =>
    navigate({ to: "/power-finder", search: { ...search, ...patch }, replace: true });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shortlistId, setShortlistId] = useState<string | null>(null);
  const [operatorEvidence, setOperatorEvidence] = useState<OperatorEvidenceResult | null>(null);
  const [operatorEvidenceState, setOperatorEvidenceState] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [ranking, setRanking] = useState<RankedCandidateResult | null>(null);
  const [rankingState, setRankingState] = useState<"loading" | "ready" | "error">("loading");

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
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const items = (ranking?.candidates ?? []).filter((candidate) => {
      const node = opportunityNode(candidate, collection);
      const maximumVoltage = Math.max(0, ...candidate.voltageKv);
      const matchesQuery =
        !normalizedQuery ||
        candidate.siteName.toLocaleLowerCase().includes(normalizedQuery) ||
        candidate.nodeName.toLocaleLowerCase().includes(normalizedQuery) ||
        candidate.operator?.toLocaleLowerCase().includes(normalizedQuery);
      const matchesVoltage = minimumVoltage === 0 || maximumVoltage >= minimumVoltage;
      const matchesOperator = operator === "all" || candidate.operator === operator;
      return matchesQuery && matchesVoltage && matchesOperator && Boolean(node);
    });
    return items.sort((left, right) => {
      if (candidateSort === "name") {
        return left.siteName.localeCompare(right.siteName);
      }
      if (candidateSort === "voltage") {
        return Math.max(0, ...right.voltageKv) - Math.max(0, ...left.voltageKv);
      }
      return right.screeningRank - left.screeningRank;
    });
  }, [candidateSort, collection, minimumVoltage, operator, query, ranking]);
  const selectedOpportunity =
    candidates.find((candidate) => candidate.id === search.candidate) ?? null;
  const comparisonIds = useMemo(
    () => (search.compare ?? "").split(",").filter(Boolean).slice(0, 3),
    [search.compare],
  );
  const comparedCandidates = comparisonIds
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is CandidateOpportunity => Boolean(candidate));
  const coordinates = selected ? pointCoordinates(selected) : null;
  const score = selected ? scoreFeature(selected) : null;

  useEffect(() => {
    if (!collection || !dataMode) return;
    let active = true;
    setRankingState("loading");
    void loadRankedCandidates(collection, requiredImportMw, maxDistanceKm, dataMode)
      .then((result) => {
        if (!active) return;
        setRanking(result);
        setRankingState("ready");
      })
      .catch(() => {
        if (!active) return;
        setRanking(null);
        setRankingState("error");
      });
    return () => {
      active = false;
    };
  }, [collection, dataMode, maxDistanceKm, requiredImportMw]);

  useEffect(() => {
    if (!selectedOpportunity || selected?.id === selectedOpportunity.nodeId) return;
    const node = opportunityNode(selectedOpportunity, collection);
    if (node) setSelected(node);
  }, [collection, selected?.id, selectedOpportunity]);

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
                name="grid-search"
                autoComplete="off"
                onChange={(event) => void updateSearch({ q: event.target.value || undefined })}
                placeholder="Search node, operator, or ID…"
              />
            </label>
            <div className="power-finder-filter-grid">
              <label>
                <span>Required import</span>
                <input
                  type="number"
                  name="required-import"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  autoComplete="off"
                  value={requiredImportMw}
                  onChange={(event) =>
                    void updateSearch({ mw: Number(event.target.value) || undefined })
                  }
                />
              </label>
              <label>
                <span>Maximum distance</span>
                <select
                  name="maximum-distance"
                  value={maxDistanceKm}
                  onChange={(event) =>
                    void updateSearch({ distance: Number(event.target.value) || undefined })
                  }
                >
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={20}>20 km</option>
                  <option value={50}>50 km</option>
                </select>
              </label>
              <label>
                <span>Minimum voltage</span>
                <select
                  value={minimumVoltage}
                  onChange={(event) =>
                    void updateSearch({ voltage: Number(event.target.value) || undefined })
                  }
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
                <select
                  value={operator}
                  onChange={(event) =>
                    void updateSearch({
                      operator: event.target.value === "all" ? undefined : event.target.value,
                    })
                  }
                >
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
                <h2>Ranked opportunities</h2>
                <small role="status" aria-live="polite">
                  {rankingState === "loading"
                    ? "Calculating…"
                    : `${candidates.length} site-to-node pathways`}
                </small>
              </span>
              <label>
                <span className="sr-only">Sort candidates</span>
                <select
                  value={candidateSort}
                  onChange={(event) =>
                    void updateSearch({ sort: event.target.value as CandidateSort })
                  }
                >
                  <option value="context">Best context</option>
                  <option value="voltage">Highest voltage</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </header>
            {rankingState === "error" && (
              <p className="power-finder-no-results" role="status">
                Candidate ranking is unavailable. Change the map view or try again.
              </p>
            )}
            {rankingState === "ready" && candidates.length === 0 && (
              <p className="power-finder-no-results">
                No site-to-node pathways are within {maxDistanceKm} km in this view.
              </p>
            )}
            {candidates.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={selectedOpportunity?.id === candidate.id ? "active" : ""}
                onClick={() => {
                  const node = opportunityNode(candidate, collection);
                  if (node) setSelected(node);
                  void updateSearch({ candidate: candidate.id });
                }}
              >
                <span className="candidate-rank">{index + 1}</span>
                <span>
                  <b>{candidate.siteName}</b>
                  <small>
                    {candidate.nodeName} · {distanceFormatter.format(candidate.distanceKm)} km
                  </small>
                  <span className="candidate-badges">
                    <i data-fit={candidate.voltageFit}>{candidate.voltageFit} voltage</i>
                    <i data-confidence={candidate.confidence}>{candidate.confidence} confidence</i>
                    <strong>{candidate.screeningRank}/100</strong>
                  </span>
                </span>
              </button>
            ))}
            {ranking && <p className="candidate-boundary">{ranking.evidenceBoundary}</p>}
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
              onSelect={(feature) => {
                setSelected(feature);
                void updateSearch({ candidate: undefined });
              }}
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

          {comparedCandidates.length > 0 && (
            <section className="candidate-comparison" aria-label="Candidate comparison">
              <header>
                <span>
                  <GitCompareArrows aria-hidden="true" />
                  <b>Compare {comparedCandidates.length} Candidates</b>
                </span>
                <button
                  type="button"
                  onClick={() => void updateSearch({ compare: undefined })}
                  aria-label="Clear candidate comparison"
                >
                  Clear
                </button>
              </header>
              <div>
                {comparedCandidates.map((candidate) => (
                  <article key={candidate.id}>
                    <strong>{candidate.siteName}</strong>
                    <span>{candidate.nodeName}</span>
                    <dl>
                      <div>
                        <dt>Rank</dt>
                        <dd>{candidate.screeningRank}/100</dd>
                      </div>
                      <div>
                        <dt>Distance</dt>
                        <dd>{candidate.distanceKm} km</dd>
                      </div>
                      <div>
                        <dt>Voltage fit</dt>
                        <dd>{candidate.voltageFit}</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{candidate.confidence}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          )}

          <aside className={`power-finder-detail ${selected ? "open" : ""}`}>
            {selected ? (
              <>
                <button
                  className="detail-close"
                  onClick={() => {
                    setSelected(null);
                    void updateSearch({ candidate: undefined });
                  }}
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
                {selectedOpportunity && (
                  <section className="candidate-intelligence" aria-label="Candidate intelligence">
                    <header>
                      <span>
                        <strong>{selectedOpportunity.screeningRank}/100</strong>
                        <small>screening rank</small>
                      </span>
                      <b>{selectedOpportunity.siteName}</b>
                    </header>
                    <dl>
                      <div>
                        <dt>Distance</dt>
                        <dd>{selectedOpportunity.distanceKm} km straight-line</dd>
                      </div>
                      <div>
                        <dt>Voltage fit</dt>
                        <dd>{selectedOpportunity.voltageFit}</dd>
                      </div>
                      <div>
                        <dt>Evidence confidence</dt>
                        <dd>{selectedOpportunity.confidence}</dd>
                      </div>
                    </dl>
                    <h3>Open constraints</h3>
                    <ul>
                      {selectedOpportunity.constraints.map((constraint) => (
                        <li key={constraint}>{constraint}</li>
                      ))}
                    </ul>
                    <h3>Evidence Still Required</h3>
                    <ul className="candidate-evidence-gaps">
                      {selectedOpportunity.missingEvidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <small className="candidate-calculation-version">
                      {selectedOpportunity.source === "database"
                        ? "Live spatial metric"
                        : "Accepted-release fallback"}{" "}
                      · {selectedOpportunity.calculationVersion}
                    </small>
                    <p>{candidateEvidenceBoundary}</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        const next = comparisonIds.includes(selectedOpportunity.id)
                          ? comparisonIds.filter((id) => id !== selectedOpportunity.id)
                          : [...comparisonIds, selectedOpportunity.id].slice(-3);
                        void updateSearch({ compare: next.length ? next.join(",") : undefined });
                      }}
                    >
                      <GitCompareArrows aria-hidden="true" />
                      {comparisonIds.includes(selectedOpportunity.id)
                        ? "Remove From Comparison"
                        : "Add to Comparison"}
                    </button>
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
                      void savePowerFinderCandidate(selected, selectedOpportunity, requiredImportMw)
                        .then((id) => {
                          setShortlistId(id);
                          setSaveStatus("saved");
                          return navigate({
                            to: "/assessments/new",
                            search: {
                              shortlistId: id,
                              name: selectedOpportunity?.siteName ?? selected.properties.name,
                              projectType: "large_load",
                              importMw: requiredImportMw,
                              latitude: coordinates[1],
                              longitude: coordinates[0],
                              federalState: "Brandenburg",
                              challenge: selectedOpportunity
                                ? `${selectedOpportunity.siteName} screened against ${selectedOpportunity.nodeName} at ${selectedOpportunity.distanceKm} km. Rank ${selectedOpportunity.screeningRank}/100 reflects context only; capacity, feasibility, cost, and timing require operator confirmation.`
                                : `Screening candidate ${selected.id}; capacity and operator responsibility require confirmation.`,
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
                      void savePowerFinderCandidate(selected, selectedOpportunity, requiredImportMw)
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
