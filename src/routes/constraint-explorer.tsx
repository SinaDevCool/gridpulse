import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Database, Map, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { evidenceClassLabel } from "@/features/grid-connection/evidence";
import { layersForExperience } from "@/features/map/map-layer-registry";
import { enquiryReadiness } from "@/features/operator-enquiry/readiness";

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
          <section
            className="constraint-map-placeholder"
            aria-label="Accessible constraint map summary"
          >
            <Map aria-hidden="true" />
            <h2>Germany constraint context</h2>
            <p>
              The production map reuses the Power Finder map platform. Regional and postcode
              evidence is aggregated; only published exact locations may appear as points.
            </p>
            <div className="constraint-corridors" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span>Map findings are fully available in the ranked list.</span>
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
