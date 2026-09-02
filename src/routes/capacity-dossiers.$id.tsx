import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, Map, RadioTower } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/product/AppShell";
import {
  getAnonymousProperty,
  getWorkspaceSettings,
} from "@/features/anonymous-workspace/repository";
import type {
  AnonymousProperty,
  QualificationDimensionKey,
} from "@/features/anonymous-workspace/schema";
import { projectAnonymousProperty } from "@/features/anonymous-workspace/portfolio-projection";
import { buildLocalCapacityDossier } from "@/features/properties/local-dossier";
import type { CapacityDossierProjection } from "@/features/properties/capacity-dossier";
import { downloadClientDecisionPackage } from "@/features/properties/decision-package";
import {
  decisionRecommendationLabel,
  deriveQualification,
  qualificationLabels,
} from "@/features/anonymous-workspace/data-centre-qualification";

const mvpQualificationKeys: QualificationDimensionKey[] = [
  "grid",
  "land",
  "planning",
  "environment",
  "access_logistics",
  "fibre",
];

export const Route = createFileRoute("/capacity-dossiers/$id")({
  head: () => ({
    meta: [
      { title: "Current Decision Package | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DecisionRecordPage,
});

function DecisionRecordPage() {
  const { id } = Route.useParams();
  const [record, setRecord] = useState<{
    property: AnonymousProperty;
    dossier: CapacityDossierProjection;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void getAnonymousProperty(id).then((property) => {
      setRecord(property ? { property, dossier: buildLocalCapacityDossier(property) } : null);
      setLoading(false);
    });
  }, [id]);
  return (
    <AppShell>
      <main id="main-content" className="site-decision-record-page">
        {loading ? (
          <div className="decision-empty" role="status">
            Loading decision package…
          </div>
        ) : !record ? (
          <div className="decision-empty">
            <h1>Site Not Found Locally</h1>
            <p>Restore a workspace backup or return to Sites.</p>
            <Link to="/portfolio" className="primary-button">
              Return to Sites
            </Link>
          </div>
        ) : (
          <DecisionRecord property={record.property} data={record.dossier} />
        )}
      </main>
    </AppShell>
  );
}

function DecisionRecord({
  property,
  data,
}: {
  property: AnonymousProperty;
  data: CapacityDossierProjection;
}) {
  const summary = projectAnonymousProperty(property);
  const qualification = deriveQualification(property);
  const [downloading, setDownloading] = useState(false);
  const acceptedEvidence = (property.evidenceRegister ?? []).filter(
    (item) => item.validationStatus === "validated",
  );
  const gridStatus = data.dossier.fail_closed
    ? "Capacity not established"
    : "Validated evidence attached";
  return (
    <>
      <header className="record-header">
        <Link to="/portfolio" search={{ view: "pipeline" }} className="back-link">
          <ArrowLeft aria-hidden="true" /> Sites
        </Link>
        <div>
          <p className="context-label">Decision Package</p>
          <h1>{property.name}</h1>
          <p>
            {summary.locationLabel} · {summary.requiredMw} MW declared
          </p>
        </div>
        <div className="record-header-actions">
          <Link
            className="secondary-button"
            to="/portfolio/$id"
            params={{ id: property.id }}
            search={{ tab: "decision" }}
          >
            Review Decision
          </Link>
          <button
            type="button"
            className="primary-button"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                downloadClientDecisionPackage(property, data, await getWorkspaceSettings());
              } finally {
                setDownloading(false);
              }
            }}
          >
            <Download aria-hidden="true" /> {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </header>

      <section className="record-decision-summary" aria-label="Decision summary">
        <article>
          <span>Decision</span>
          <strong className={`decision-chip is-${property.decisionStatus}`}>
            {decisionRecommendationLabel(property)}
          </strong>
          <p>{property.decisionRationale ?? "No rationale recorded yet."}</p>
        </article>
        <article>
          <span>Connection Hypothesis</span>
          <strong>
            {summary.preferredCandidate?.nodeName ??
              summary.recommendedCandidate?.nodeName ??
              "Not screened"}
          </strong>
          <p>
            {summary.preferredCandidate
              ? `${summary.preferredCandidate.distanceKm.toFixed(1)} km · ${summary.operator ?? "operator unconfirmed"}`
              : "Investigate candidates in Power Finder."}
          </p>
        </article>
        <article>
          <span>Next Action</span>
          <strong>{summary.nextAction}</strong>
          <p>
            {summary.blockers.length} open {summary.blockers.length === 1 ? "check" : "checks"}
          </p>
        </article>
      </section>

      <section className="record-evidence-status" aria-label="Evidence status">
        <article>
          <Map aria-hidden="true" />
          <div>
            <span>Grid Position</span>
            <strong>{gridStatus}</strong>
            <p>
              {summary.preferredCandidate
                ? `${summary.preferredCandidate.nodeName} · ${summary.preferredCandidate.distanceKm.toFixed(1)} km`
                : "No candidate shortlisted"}
            </p>
          </div>
        </article>
        <article>
          <CheckCircle2 aria-hidden="true" />
          <div>
            <span>Readiness</span>
            <strong>{qualification.confirmedReadiness}% confirmed</strong>
            <p>{qualification.screeningCoverage}% public screening coverage</p>
          </div>
        </article>
        <article>
          <RadioTower aria-hidden="true" />
          <div>
            <span>Evidence</span>
            <strong>{acceptedEvidence.length} validated</strong>
            <p>{summary.operator ?? "Operator responsibility unconfirmed"}</p>
          </div>
        </article>
      </section>

      <section className="record-qualification-section">
        <p className="context-label">MVP Review</p>
        <h2>Essential Qualification</h2>
        <p className="record-section-intro">
          The 6 checks needed to decide whether this site should advance.
        </p>
        <div>
          {qualification.dimensions
            .filter((item) => mvpQualificationKeys.includes(item.key))
            .map((item) => (
              <article key={item.key} className={`status-${item.status}`}>
                <span>{qualificationLabels[item.key]}</span>
                <strong>{item.status}</strong>
                <p>{item.summary ?? "Not assessed"}</p>
                <small>
                  {item.unsupported
                    ? "Supporting evidence needed"
                    : `${item.acceptedEvidence} validated evidence item(s)`}
                </small>
              </article>
            ))}
        </div>
      </section>

      <div className="record-grid">
        <section>
          <p className="context-label">Site Brief</p>
          <h2>Decision Inputs</h2>
          <dl className="record-definition-list">
            <div>
              <dt>Required load</dt>
              <dd>{summary.requiredMw} MW</dd>
            </div>
            <div>
              <dt>Land control</dt>
              <dd>{property.landControlStatus.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Likely operator</dt>
              <dd>{summary.operator ?? "Unconfirmed"}</dd>
            </div>
            <div>
              <dt>Validated evidence</dt>
              <dd>{acceptedEvidence.length} item(s)</dd>
            </div>
          </dl>
        </section>
        <section>
          <p className="context-label">Grid Screen</p>
          <h2>Candidate Comparison</h2>
          {data.alternatives.length ? (
            <div className="record-candidate-list">
              {data.alternatives.slice(0, 3).map((candidate) => (
                <article
                  className={candidate.id === property.preferredCandidateId ? "is-preferred" : ""}
                  key={candidate.id}
                >
                  <div>
                    <b>{candidate.name}</b>
                    {candidate.id === property.preferredCandidateId ? (
                      <span>Shortlisted</span>
                    ) : null}
                  </div>
                  <p>
                    {candidate.distance_km == null
                      ? "Distance unknown"
                      : `${candidate.distance_km.toFixed(1)} km`}{" "}
                    ·{" "}
                    {candidate.voltage_kv == null
                      ? "Voltage unknown"
                      : `${candidate.voltage_kv} kV`}
                  </p>
                  <small>
                    {candidate.operator ?? "Operator unconfirmed"} · capacity not established
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="record-empty-copy">
              No candidate snapshot. Screen this site in Power Finder.
            </p>
          )}
        </section>
      </div>

      <section className="record-evidence-grid">
        <List
          title="Evidence Register"
          items={(property.evidenceRegister ?? []).map(
            (item) => `${item.title}: ${item.claim} [${item.validationStatus}]`,
          )}
        />
        <List title="Open Checks" items={data.dossier.unresolved_evidence} />
        <List title="Operator Questions" items={data.dossier.operator_questions} />
      </section>
      <p className="record-footnote">
        Grid screening supports preliminary decisions. Capacity, cost, feasibility and delivery
        timing require operator confirmation.
      </p>
    </>
  );
}

function List({ title, items = [] }: { title: string; items?: unknown[] }) {
  return (
    <article>
      <h2>{title}</h2>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
          ))}
        </ul>
      ) : (
        <p>None recorded.</p>
      )}
    </article>
  );
}
