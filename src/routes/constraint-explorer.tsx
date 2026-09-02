import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Database,
  Info,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { z } from "zod";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { PowerFinderMap } from "@/components/product/PowerFinderMap";
import { publicConstraintScreening } from "@/features/constraint-exposure/public-screening";
import { evidenceClassLabel } from "@/features/grid-connection/evidence";
import { enquiryReadiness } from "@/features/operator-enquiry/readiness";
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
  metric: z.enum(["exposure", "redispatch", "outage", "confidence"]).optional().catch(undefined),
  period: z.enum(["current", "historical", "scenario"]).optional().catch(undefined),
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

const findings = publicConstraintScreening;

type Layers = {
  gridLines: boolean;
  gridNodes: boolean;
  constraintExposure: boolean;
  outages: boolean;
  phaseShifters: boolean;
};
const equipment = [
  ["Transmission Lines", "Public topology"],
  ["Transformers", "Where published"],
  ["Substations", "Public nodes"],
  ["Phase-Shifting Transformers", "Evidence dependent"],
  ["Generators", "Registry context"],
] as const;

function ToggleRow({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="constraint-toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function ConstraintExplorerPage() {
  const { resolved: basemapMode } = useTheme();
  const search = Route.useSearch();
  const [severity, setSeverity] = useState(search.severity ?? "all");
  const [evidence, setEvidence] = useState(search.evidence ?? "all");
  const [metric, setMetric] = useState(search.metric ?? "exposure");
  const [period, setPeriod] = useState(search.period ?? "current");
  const [selectedId, setSelectedId] = useState(search.constraint ?? findings[0].id);
  const [analysisDate, setAnalysisDate] = useState("2026-09-02");
  const [timeline, setTimeline] = useState(72);
  const [layers, setLayers] = useState<Layers>({
    gridLines: true,
    gridNodes: true,
    constraintExposure: true,
    outages: true,
    phaseShifters: false,
  });
  const [mapCollection, setMapCollection] = useState<PowerFinderCollection | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<PowerFinderBounds>({
    west: 7.9,
    south: 52.7,
    east: 9.4,
    north: 53.5,
  });
  const [mapFeature, setMapFeature] = useState<PowerFinderFeature | null>(null);

  const updateUrl = (patch: Record<string, string>) => {
    const url = new URL(window.location.href);
    Object.entries(patch).forEach(([key, value]) =>
      value === "all" || value === "current"
        ? url.searchParams.delete(key)
        : url.searchParams.set(key, value),
    );
    window.history.replaceState(window.history.state, "", url);
  };
  const filtered = useMemo(
    () =>
      findings.filter(
        (item) =>
          (severity === "all" || item.severity === severity) &&
          (evidence === "all" || item.provenance.evidenceClass === evidence) &&
          (period === "current" ||
            (period === "historical" && item.provenance.evidenceClass === "public_source") ||
            (period === "scenario" && item.provenance.evidenceClass === "derived")),
      ),
    [evidence, period, severity],
  );
  const selected = findings.find((item) => item.id === selectedId) ?? filtered[0];
  const setLayer = (key: keyof Layers, value: boolean) =>
    setLayers((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if ((bounds.east - bounds.west) * (bounds.north - bounds.south) > 6) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () =>
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
          }),
      250,
    );
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [bounds]);

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
          description="Explore public signals, modelled exposure, evidence gaps, and mitigations without presenting screening context as available capacity."
          action={
            <Link to="/data-sources" className="secondary-button">
              Data &amp; Methodology
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
          <aside className="constraint-control-rail" aria-label="Constraint analysis controls">
            <header>
              <div>
                <span className="context-label">Germany</span>
                <h2>Constraint Analysis</h2>
              </div>
              <Info aria-hidden="true" />
            </header>
            <div className="constraint-mode-tabs" role="group" aria-label="Analysis period">
              {(["current", "historical", "scenario"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={period === value ? "active" : ""}
                  aria-pressed={period === value}
                  onClick={() => {
                    setPeriod(value);
                    updateUrl({ period: value });
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="constraint-control-section constraint-time-controls">
              <label htmlFor="constraint-date">
                <CalendarDays aria-hidden="true" /> Analysis Date
              </label>
              <input
                id="constraint-date"
                name="constraint-date"
                type="date"
                value={analysisDate}
                onChange={(event) => setAnalysisDate(event.currentTarget.value)}
              />
              <label htmlFor="constraint-time">
                Time Window <output htmlFor="constraint-time">{timeline}:00</output>
              </label>
              <input
                id="constraint-time"
                name="constraint-time"
                type="range"
                min="0"
                max="168"
                step="6"
                value={timeline}
                onChange={(event) => setTimeline(Number(event.currentTarget.value))}
              />
            </div>
            <details className="constraint-control-section" open>
              <summary>
                <span>
                  <CircleDot aria-hidden="true" /> Constraints
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="constraint-control-body">
                <label htmlFor="constraint-metric">Exposure Metric</label>
                <select
                  id="constraint-metric"
                  value={metric}
                  onChange={(event) => {
                    const value = event.currentTarget.value as typeof metric;
                    setMetric(value);
                    updateUrl({ metric: value });
                  }}
                >
                  <option value="exposure">Composite exposure</option>
                  <option value="redispatch">Redispatch signal</option>
                  <option value="outage">Outage proximity</option>
                  <option value="confidence">Evidence confidence</option>
                </select>
                <label htmlFor="constraint-severity">Severity</label>
                <select
                  id="constraint-severity"
                  value={severity}
                  onChange={(event) => {
                    const value = event.currentTarget.value as typeof severity;
                    setSeverity(value);
                    updateUrl({ severity: value });
                  }}
                >
                  <option value="all">All severities</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <label htmlFor="constraint-evidence">Evidence Class</label>
                <select
                  id="constraint-evidence"
                  value={evidence}
                  onChange={(event) => {
                    const value = event.currentTarget.value as typeof evidence;
                    setEvidence(value);
                    updateUrl({ evidence: value });
                  }}
                >
                  <option value="all">All evidence</option>
                  <option value="public_source">Observed public</option>
                  <option value="derived">Modelled / derived</option>
                  <option value="operator_confirmed">Operator confirmed</option>
                </select>
                <ToggleRow
                  checked={layers.constraintExposure}
                  label="Constraint Exposure"
                  hint="Illustrative screening layer"
                  onChange={(value) => setLayer("constraintExposure", value)}
                />
              </div>
            </details>
            <details className="constraint-control-section" open>
              <summary>
                <span>
                  <AlertTriangle aria-hidden="true" /> Outages &amp; Equipment
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="constraint-control-body">
                <ToggleRow
                  checked={layers.outages}
                  label="Outage Context"
                  hint="Planned, forced & derated"
                  onChange={(value) => setLayer("outages", value)}
                />
                <ul className="constraint-equipment-list">
                  {equipment.map(([label, hint]) => (
                    <li key={label}>
                      <span aria-hidden="true" />
                      <div>
                        <strong>{label}</strong>
                        <small>{hint}</small>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="constraint-event-legend">
                  <span className="planned">Planned</span>
                  <span className="forced">Forced</span>
                  <span className="derated">Derated</span>
                </div>
              </div>
            </details>
            <details className="constraint-control-section">
              <summary>
                <span>
                  <Layers3 aria-hidden="true" /> Grid Infrastructure
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="constraint-control-body">
                <ToggleRow
                  checked={layers.gridLines}
                  label="Grid Lines"
                  hint="Voltage-styled public topology"
                  onChange={(value) => setLayer("gridLines", value)}
                />
                <ToggleRow
                  checked={layers.gridNodes}
                  label="Grid Nodes"
                  hint="Published connection context"
                  onChange={(value) => setLayer("gridNodes", value)}
                />
                <ToggleRow
                  checked={layers.phaseShifters}
                  label="Phase Shifters"
                  hint="Shown only where evidenced"
                  onChange={(value) => setLayer("phaseShifters", value)}
                />
              </div>
            </details>
          </aside>
          <section className="constraint-map" aria-label="Germany constraint context map">
            {mapCollection ? (
              <PowerFinderMap
                collection={mapCollection}
                enabledLayers={{
                  node: layers.gridNodes,
                  line: layers.gridLines,
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
            <div className="constraint-map-caption">
              <strong>
                {period === "current"
                  ? "Current public context"
                  : period === "historical"
                    ? "Historical evidence view"
                    : "Illustrative scenario"}
              </strong>
              <span>
                {metric.replaceAll("_", " ")} · {analysisDate} · {timeline}:00
              </span>
            </div>
            <aside className="constraint-map-legend" aria-label="Map legend">
              <header>
                <span className="context-label">Legend</span>
                <h2>Constraint &amp; Grid Layers</h2>
              </header>
              <section>
                <h3>Constraint Exposure</h3>
                <div className="constraint-gradient" aria-hidden="true" />
                <div className="constraint-gradient-labels">
                  <span>Lower</span>
                  <span>Indicative</span>
                  <span>Higher</span>
                </div>
                <p>
                  Severity combines available public signals and evidence quality; it is not
                  available capacity.
                </p>
              </section>
              <section>
                <h3>Voltage</h3>
                <ul>
                  <li>
                    <i className="voltage-380" />
                    380 kV &amp; above
                  </li>
                  <li>
                    <i className="voltage-220" />
                    220–&lt;380 kV
                  </li>
                  <li>
                    <i className="voltage-110" />
                    110–&lt;220 kV
                  </li>
                  <li>
                    <i className="voltage-low" />
                    Below 110 kV
                  </li>
                  <li>
                    <i className="voltage-unknown" />
                    Voltage not mapped
                  </li>
                </ul>
              </section>
              <section>
                <h3>Evidence</h3>
                <ul>
                  <li>
                    <i className="evidence-public" />
                    Observed public
                  </li>
                  <li>
                    <i className="evidence-derived" />
                    Modelled / derived
                  </li>
                  <li>
                    <i className="evidence-confirmed" />
                    Operator confirmed
                  </li>
                </ul>
              </section>
            </aside>
            {layers.constraintExposure ? (
              <div className="constraint-map-evidence">
                <span className={`constraint-severity ${selected?.severity ?? "moderate"}`}>
                  {selected?.severity ?? "moderate"}
                </span>
                <strong>{selected?.name ?? "Select an exposure"}</strong>
                <small>
                  {mapFeature
                    ? `Map selection: ${mapFeature.properties.name}`
                    : selected?.affectedAssetOrRegion}
                </small>
              </div>
            ) : null}
          </section>
          <section className="constraint-results" aria-labelledby="constraint-results-title">
            <header>
              <div>
                <h2 id="constraint-results-title">Ranked Exposure</h2>
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
                  <small>{item.affectedAssetOrRegion}</small>
                  <em>{item.scenario}</em>
                </button>
              ))
            ) : (
              <p className="constraint-empty">
                No constraints match these filters. Adjust severity or evidence class.
              </p>
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
                {selected.affectedAssetOrRegion} · {selected.category.replaceAll("_", " ")}
              </p>
            </div>
            <dl>
              <div>
                <dt>Direction</dt>
                <dd>{selected.direction}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{evidenceClassLabel[selected.provenance.evidenceClass]}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{selected.provenance.confidence}</dd>
              </div>
              <div>
                <dt>Capacity Claim</dt>
                <dd>No</dd>
              </div>
            </dl>
            <p>
              <AlertTriangle aria-hidden="true" />
              <strong>Next Action:</strong> {selected.requiredAction}
            </p>
          </section>
        ) : null}
        <section className="constraint-detail" aria-labelledby="enquiry-readiness-title">
          <h2 id="enquiry-readiness-title">Operator Enquiry Readiness</h2>
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
            Complete Project Assumptions
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
