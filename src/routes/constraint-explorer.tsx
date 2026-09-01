import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { evidenceClassLabel } from "@/features/grid-connection/evidence";
import { layersForExperience } from "@/features/map/map-layer-registry";
import { enquiryReadiness } from "@/features/operator-enquiry/readiness";
import { PowerFinderMap } from "@/components/product/PowerFinderMap";
import {
  loadPowerFinderViewport,
  type PowerFinderBounds,
} from "@/features/power-finder/data-source";
import type {
  PowerFinderCollection,
  PowerFinderFeature,
} from "@/features/power-finder/fixture-data";
import { useTheme } from "@/features/theme/use-theme";

const searchSchema = z.object({
  severity: z.enum(["all", "moderate", "high", "critical"]).optional().catch(undefined),
  evidence: z
    .enum(["all", "public_source", "derived", "operator_confirmed"])
    .optional()
    .catch(undefined),
  constraint: z.string().optional().catch(undefined),
});
export const Route = createFileRoute("/constraint-explorer")({
  validateSearch: searchSchema,
  component: ConstraintExplorerPage,
  head: () => ({
    meta: [
      { title: "Constraint Explorer | GridPulse" },
      {
        name: "description",
        content:
          "Evidence-aware German grid constraint exposure for infrastructure site decisions.",
      },
    ],
  }),
});

const illustrative = [
  {
    id: "regional-redispatch",
    name: "Regional redispatch signal",
    category: "generation",
    severity: "high",
    region: "North-west Germany",
    direction: "unknown",
    evidence: "public_source",
    confidence: "indicative",
    frequency: "Observed context",
    action: "Request operator confirmation for the proposed connection point.",
  },
  {
    id: "n1-corridor",
    name: "N-1 corridor exposure",
    category: "thermal",
    severity: "moderate",
    region: "Illustrative study corridor",
    direction: "aggravating",
    evidence: "derived",
    confidence: "indicative",
    frequency: "Scenario dependent",
    action: "Run a project-specific canonical network assessment.",
  },
  {
    id: "data-gap",
    name: "Equipment rating gap",
    category: "data_uncertainty",
    severity: "critical",
    region: "Candidate connection context",
    direction: "unknown",
    evidence: "derived",
    confidence: "unverified",
    frequency: "Not assessable",
    action: "Obtain accepted ratings and applicable security criteria.",
  },
] as const;

function ConstraintExplorerPage() {
  const { resolved: basemapMode } = useTheme();
  const search = Route.useSearch();
  const [severity, setSeverity] = useState(search.severity ?? "all");
  const [evidence, setEvidence] = useState(search.evidence ?? "all");
  const updateUrl = (patch: { severity?: string; evidence?: string; constraint?: string }) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === "all") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState(window.history.state, "", url);
  };
  const [selectedId, setSelectedId] = useState(search.constraint ?? illustrative[0].id);
  const filtered = useMemo(
    () =>
      illustrative.filter(
        (item) =>
          (severity === "all" || item.severity === severity) &&
          (evidence === "all" || item.evidence === evidence),
      ),
    [evidence, severity],
  );
  const selected = illustrative.find((item) => item.id === selectedId) ?? filtered[0];
  const [mapCollection, setMapCollection] = useState<PowerFinderCollection | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<PowerFinderBounds>({
    west: 7.9,
    south: 52.7,
    east: 9.4,
    north: 53.5,
  });
  const [mapFeature, setMapFeature] = useState<PowerFinderFeature | null>(null);
  useEffect(() => {
    if ((bounds.east - bounds.west) * (bounds.north - bounds.south) > 6) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadPowerFinderViewport(bounds, controller.signal, {
        fallbackAllowed: true,
        includeRegistryAssets: false,
      })
        .then(({ collection }) => {
          setMapCollection(collection);
          setMapError(null);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setMapError(reason instanceof Error ? reason.message : "Map context could not load.");
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [bounds]);
  const layers = layersForExperience("constraint_explorer");
  const readiness = enquiryReadiness({
    site: false,
    requestedImport: false,
    loadProfile: false,
    targetDate: false,
    phasing: false,
    constraintExposure: true,
    sourceReferences: true,
  });
  return (
    <AppShell>
      <main id="main-content" className="section-page constraint-explorer">
        <PageHeading
          eyebrow="Constraint exposure"
          title="Understand what may constrain a site"
          description="Explore observed public signals, modelled exposure, evidence gaps, and mitigations without presenting screening context as available capacity."
          action={
            <Link to="/data-sources" className="secondary-button">
              Data & methodology
            </Link>
          }
        />
        <section className="constraint-truth-banner">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Screening evidence—not a capacity offer.</strong> Exact connection capacity and
            operating terms require confirmation from the responsible network operator.
          </p>
        </section>
        <div className="constraint-workbench">
          <aside className="constraint-filters" aria-label="Constraint filters">
            <h2>Analysis view</h2>
            <label>
              Severity
              <select
                value={severity}
                onChange={(event) => {
                  setSeverity(event.currentTarget.value as typeof severity);
                  updateUrl({ severity: event.currentTarget.value });
                }}
              >
                <option value="all">All severities</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Evidence
              <select
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.currentTarget.value as typeof evidence);
                  updateUrl({ evidence: event.currentTarget.value });
                }}
              >
                <option value="all">All evidence</option>
                <option value="public_source">Observed public</option>
                <option value="derived">Modelled / derived</option>
                <option value="operator_confirmed">Operator confirmed</option>
              </select>
            </label>
            <h3>Active layers</h3>
            <ul>
              {layers.map((layer) => (
                <li key={layer.id}>
                  <span>{layer.defaultVisible ? "On" : "Off"}</span>
                  {layer.label}
                  <small>from zoom {layer.minimumZoom}</small>
                </li>
              ))}
            </ul>
          </aside>
          <section className="constraint-map" aria-label="Germany constraint context map">
            <div className="constraint-map-caption">
              <strong>Grid context</strong>
              <span>Public infrastructure · selected exposure remains screening evidence</span>
            </div>
            {mapCollection ? (
              <PowerFinderMap
                collection={mapCollection}
                enabledLayers={{
                  node: true,
                  line: true,
                  industrial_site: false,
                  generation_asset: false,
                  storage_asset: false,
                }}
                selectedFeature={mapFeature}
                mapMode="evidence"
                basemapMode={basemapMode}
                onSelect={setMapFeature}
                onViewportChange={setBounds}
              />
            ) : (
              <div className="constraint-map-state" role="status" aria-live="polite">
                {mapError ?? "Loading grid context…"}
              </div>
            )}
            <div className="constraint-map-evidence">
              <span className={`constraint-severity ${selected?.severity ?? "moderate"}`}>
                {selected?.severity ?? "moderate"}
              </span>
              <strong>{selected?.name ?? "Select an exposure"}</strong>
              <small>{mapFeature ? `Map selection: ${mapFeature.properties.name}` : selected?.region}</small>
            </div>
          </section>
          <section className="constraint-results" aria-labelledby="constraint-results-title">
            <header>
              <div>
                <h2 id="constraint-results-title">Ranked exposure</h2>
                <p>{filtered.length} illustrative findings</p>
              </div>
              <Database aria-hidden="true" />
            </header>
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selected?.id === item.id ? "active" : ""}
                  onClick={() => {
                    setSelectedId(item.id);
                    updateUrl({ constraint: item.id });
                  }}
                >
                  <span className={`constraint-severity ${item.severity}`}>{item.severity}</span>
                  <strong>{item.name}</strong>
                  <small>{item.region}</small>
                  <em>{item.frequency}</em>
                </button>
              ))
            ) : (
              <p>No constraints match these filters.</p>
            )}
          </section>
        </div>
        {selected ? (
          <section className="constraint-detail" aria-labelledby="constraint-detail-title">
            <div>
              <span className={`constraint-severity ${selected.severity}`}>
                {selected.severity}
              </span>
              <h2 id="constraint-detail-title">{selected.name}</h2>
              <p>
                {selected.region} · {selected.category.replaceAll("_", " ")}
              </p>
            </div>
            <dl>
              <div>
                <dt>Direction</dt>
                <dd>{selected.direction}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{evidenceClassLabel[selected.evidence]}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{selected.confidence}</dd>
              </div>
              <div>
                <dt>Capacity claim</dt>
                <dd>No</dd>
              </div>
            </dl>
            <p>
              <AlertTriangle aria-hidden="true" />
              <strong>Next action:</strong> {selected.action}
            </p>
          </section>
        ) : null}
        <section className="constraint-detail" aria-labelledby="enquiry-readiness-title">
          <h2 id="enquiry-readiness-title">Operator enquiry readiness</h2>
          <p>
            {readiness.completed} of {readiness.total} required inputs are present in this
            illustrative view.
          </p>
          <ul>
            {readiness.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link to="/data-centre-planner" className="primary-button">
            Complete project assumptions
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
