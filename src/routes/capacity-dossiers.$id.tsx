import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/product/AppShell";
import {
  getAnonymousProperty,
  getWorkspaceSettings,
} from "@/features/anonymous-workspace/repository";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import { projectAnonymousProperty } from "@/features/anonymous-workspace/portfolio-projection";
import { buildLocalCapacityDossier } from "@/features/properties/local-dossier";
import {
  capacityValue,
  type CapacityDossierProjection,
} from "@/features/properties/capacity-dossier";
import { downloadClientDecisionPackage } from "@/features/properties/decision-package";
import {
  decisionRecommendationLabel,
  deriveQualification,
  qualificationLabels,
} from "@/features/anonymous-workspace/data-centre-qualification";

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
            Loading local decision record…
          </div>
        ) : !record ? (
          <div className="decision-empty">
            <h1>Site Not Found Locally</h1>
            <p>
              This site is not stored in this browser. Restore a workspace backup or return to Site
              Pipeline.
            </p>
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
  return (
    <>
      <header className="record-header">
        <Link to="/reports" className="back-link">
          <ArrowLeft aria-hidden="true" /> Sites
        </Link>
        <div>
              <p className="context-label">Current Decision Package</p>
          <h1>{property.name}</h1>
          <p>
            {summary.locationLabel} · {summary.requiredMw} MW declared requirement
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
            onClick={async () =>
              downloadClientDecisionPackage(property, data, await getWorkspaceSettings())
            }
          >
            <Download aria-hidden="true" /> Download Record
          </button>
        </div>
      </header>
      <aside className="record-truth-boundary">
        <ShieldAlert aria-hidden="true" />
        <p>
          <strong>
            {data.dossier.evidence_class?.replaceAll("_", " ") ?? "No governed calculation"}.
          </strong>{" "}
          Grid context and calculated evidence are not a connection offer, reservation, approval,
          queue statement, or timing guarantee.
        </p>
      </aside>
      <section className="record-decision-summary">
        <article>
          <span>Client Decision</span>
          <strong className={`decision-chip is-${property.decisionStatus}`}>
            {decisionRecommendationLabel(property)}
          </strong>
          <p>{property.decisionRationale ?? "No client decision rationale has been recorded."}</p>
        </article>
        <article>
          <span>Preferred Candidate</span>
          <strong>{summary.preferredCandidate?.nodeName ?? "Not shortlisted"}</strong>
          <p>
            {summary.preferredCandidate
              ? `${summary.preferredCandidate.distanceKm.toFixed(1)} km · ${summary.operator ?? "operator unconfirmed"}`
              : "Return to Power Finder to investigate connection candidates."}
          </p>
        </article>
        <article>
          <span>Next Action</span>
          <strong>{summary.nextAction}</strong>
          <p>
            {summary.blockers.length} open evidence {summary.blockers.length === 1 ? "gap" : "gaps"}
          </p>
        </article>
      </section>
      {data.dossier.fail_closed ? (
        <p className="record-capacity-warning" role="alert">
          No currently valid capacity evidence is attached. Capacity metrics are withheld and remain
          Unknown.
        </p>
      ) : null}
      <section className="record-capacity-strip" aria-label="Capacity evidence">
        <Metric label="N-0 Capacity" value={capacityValue(data.dossier.n0_capacity_mw)} />
        <Metric label="N-1 Firm" value={capacityValue(data.dossier.n1_firm_capacity_mw)} />
        <Metric label="Flexible" value={capacityValue(data.dossier.flexible_capacity_mw)} />
        <Metric
          label="BESS-Assisted"
          value={capacityValue(data.dossier.bess_assisted_capacity_mw)}
        />
      </section>
      <section className="record-qualification-section">
        <p className="context-label">Data-centre development</p>
        <h2>Site qualification</h2>
        <div>
          {deriveQualification(property).dimensions.map((item) => (
            <article key={item.key} className={`status-${item.status}`}>
              <span>{qualificationLabels[item.key]}</span>
              <strong>{item.status}</strong>
              <p>{item.summary ?? "No finding recorded"}</p>
              <small>
                {item.unsupported
                  ? "Accepted evidence missing"
                  : `${item.acceptedEvidence} accepted evidence item(s)`}
              </small>
            </article>
          ))}
        </div>
      </section>
      <div className="record-grid">
        <section>
          <p className="context-label">Evidence Basis</p>
          <h2>Project & Validation</h2>
          <dl className="record-definition-list">
            <div>
              <dt>Required load</dt>
              <dd>{capacityValue(data.requirements.required_total_site_load_mw)}</dd>
            </div>
            <div>
              <dt>Evidence status</dt>
              <dd>{data.dossier.status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Validation</dt>
              <dd>{data.dossier.validation_status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Model version</dt>
              <dd>{data.dossier.model_version ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Study version</dt>
              <dd>{data.dossier.study_version ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Validity</dt>
              <dd>
                {data.dossier.valid_from ?? "Unknown"} – {data.dossier.valid_to ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Land control</dt>
              <dd>{property.landControlStatus}</dd>
            </div>
          </dl>
        </section>
        <section>
          <p className="context-label">Connection Alternatives</p>
          <h2>Candidate Comparison</h2>
          {data.alternatives.length ? (
            <div className="record-candidate-list">
              {data.alternatives.map((candidate) => (
                <article
                  className={candidate.id === property.preferredCandidateId ? "is-preferred" : ""}
                  key={candidate.id}
                >
                  <div>
                    <b>{candidate.name}</b>
                    {candidate.id === property.preferredCandidateId ? <span>Preferred</span> : null}
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
                    {candidate.operator ?? "Operator unconfirmed"} · capacity{" "}
                    {candidate.capacity_state.replaceAll("_", " ")}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p>
              No candidate snapshot is attached. Open this site in Power Finder to screen
              alternatives.
            </p>
          )}
        </section>
      </div>
      <section className="record-evidence-grid">
        <List
          title="Evidence Register"
          items={(property.evidenceRegister ?? []).map(
            (item) =>
              `${item.title}: ${item.claim} [${item.evidenceClass}; ${item.validationStatus}]`,
          )}
        />
        <List title="Unresolved Evidence" items={data.dossier.unresolved_evidence} />
        <List title="Operator Questions" items={data.dossier.operator_questions} />
        <List title="Assumptions" items={data.dossier.assumptions} />
        <List title="Claims & Limitations" items={data.dossier.claims_and_limitations} />
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{value === "Unknown" ? "No accepted evidence" : "Review validity before use"}</small>
    </article>
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
