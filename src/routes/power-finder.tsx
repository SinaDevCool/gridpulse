import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Database, ExternalLink, Factory, MapPin, Network, Zap } from "lucide-react";
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
};
const initialBounds: PowerFinderBounds = {
  west: 12.9,
  south: 52.1,
  east: 13.8,
  north: 52.6,
};

function PowerFinderPage() {
  const [collection, setCollection] = useState<PowerFinderCollection | null>(null);
  const [selected, setSelected] = useState<PowerFinderFeature | null>(null);
  const [enabled, setEnabled] = useState<Record<PowerFinderKind, boolean>>({
    node: true,
    line: true,
    industrial_site: true,
  });
  const [error, setError] = useState("");
  const [bounds, setBounds] = useState(initialBounds);
  const [dataMode, setDataMode] = useState<"database" | "published_artifact" | null>(null);

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
    const features = collection.features.filter((feature) => enabled[feature.properties.kind]);
    return {
      ...collection,
      features,
      metadata: { ...collection.metadata, record_count: features.length },
    };
  }, [collection, enabled]);

  const candidates = useMemo(
    () =>
      collection?.features.filter(
        (feature) =>
          feature.properties.kind === "node" || feature.properties.kind === "industrial_site",
      ) ?? [],
    [collection],
  );
  const coordinates = selected ? pointCoordinates(selected) : null;
  const score = selected ? scoreFeature(selected) : null;

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
            <h2>Candidate context</h2>
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
                {coordinates && (
                  <Link
                    to="/assessments/new"
                    search={{
                      name: selected.properties.name,
                      projectType: "large_load",
                      latitude: coordinates[1],
                      longitude: coordinates[0],
                      federalState: "Brandenburg",
                      municipality: undefined,
                      postcode: undefined,
                      importMw: undefined,
                      minimumViableImportMw: undefined,
                      exportMw: undefined,
                      batteryPowerMw: undefined,
                      batteryEnergyMwh: undefined,
                      targetDate: undefined,
                      landStatus: undefined,
                      planningStatus: undefined,
                      challenge: `Screening candidate ${selected.id}; capacity and operator responsibility require confirmation.`,
                      pilotRequestId: undefined,
                    }}
                    className="primary-button"
                  >
                    <MapPin /> Start private assessment
                  </Link>
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
