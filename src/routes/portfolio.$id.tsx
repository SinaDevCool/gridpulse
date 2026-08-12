import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Gauge,
  Gavel,
  LoaderCircle,
  Map,
  RadioTower,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/product/AppShell";
import {
  deleteAnonymousDocument,
  getAnonymousProperty,
  listAnonymousDocuments,
  saveAnonymousDocument,
  saveAnonymousProperty,
} from "@/features/anonymous-workspace/repository";
import {
  migrateAnonymousProperty,
  type AnonymousDocumentMetadata,
  type AnonymousEvidenceItem,
  type AnonymousProperty,
  type QualificationDimensionKey,
} from "@/features/anonymous-workspace/schema";
import {
  deriveQualification,
  decisionRecommendationLabel,
  qualificationLabels,
  updateQualificationDimension,
} from "@/features/anonymous-workspace/data-centre-qualification";
import { preferredCandidate } from "@/features/anonymous-workspace/portfolio-projection";
import { PropertyEnrichmentPanel } from "@/features/properties/PropertyEnrichmentPanel";
import { screenProperty } from "@/features/properties/property-screening-workflow";

const tabs = ["overview", "qualification", "grid", "evidence", "operator", "decision"] as const;
type Tab = (typeof tabs)[number];
const tabDetails: Record<Tab, { label: string; hint: string; icon: typeof Gauge }> = {
  overview: { label: "Overview", hint: "Property brief", icon: Building2 },
  qualification: { label: "Site Checks", hint: "Development review", icon: Gauge },
  grid: { label: "Power Options", hint: "Connection hypotheses", icon: Map },
  evidence: { label: "Sources", hint: "Evidence & documents", icon: FileText },
  operator: { label: "Enquiries", hint: "External engagement", icon: RadioTower },
  decision: { label: "Decision", hint: "Advance, hold or reject", icon: Gavel },
};

export const Route = createFileRoute("/portfolio/$id")({
  validateSearch: z.object({ tab: z.enum(tabs).optional() }),
  head: () => ({
    meta: [
      { title: "Site Workspace | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SiteWorkspace,
});

function SiteWorkspace() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [property, setProperty] = useState<AnonymousProperty | null>(null);
  const [documents, setDocuments] = useState<AnonymousDocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const tab = search.tab ?? "overview";
  const refresh = useCallback(async () => {
    const value = await getAnonymousProperty(id);
    setProperty(value ? migrateAnonymousProperty(value) : null);
    setDocuments(await listAnonymousDocuments(id));
    setLoading(false);
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async (next: AnonymousProperty, message = "Site saved") => {
    const updated = migrateAnonymousProperty({ ...next, updatedAt: new Date().toISOString() });
    await saveAnonymousProperty(updated);
    setProperty(updated);
    setDirty(false);
    toast.success(message);
  };
  if (loading)
    return (
      <AppShell>
        <main className="site-workspace-state">Loading site workspace…</main>
      </AppShell>
    );
  if (!property)
    return (
      <AppShell>
        <main className="site-workspace-state">
          <h1>Site not found</h1>
          <Link to="/portfolio" search={{ view: "pipeline" }}>
            Return to Sites
          </Link>
        </main>
      </AppShell>
    );
  const qualification = deriveQualification(property);
  const candidate = preferredCandidate(property);
  const recommendedCandidate = property.candidateSnapshots.find(
    (item) => item.id === property.recommendedCandidateId,
  );
  return (
    <AppShell>
      <main id="main-content" className="site-workspace-page">
        <header className="site-workspace-header">
          <div className="site-workspace-title">
            <Link to="/portfolio" search={{ view: "pipeline" }} className="back-link">
              <ArrowLeft aria-hidden="true" /> All sites
            </Link>
            <p className="context-label">Data Centre Opportunity</p>
            <h1>{property.name}</h1>
            <p>
              {property.siteLabel ?? property.municipality ?? "Location not labelled"} ·{" "}
              {property.requiredTotalSiteLoadMw ?? property.project.importMw} MW declared
            </p>
          </div>
          <div className={`decision-badge decision-${property.decisionStatus}`}>
            {decisionRecommendationLabel(property)}
          </div>
        </header>
        <section className="site-workspace-status" aria-label="Workspace status">
          <StatusMetric
            label="Confirmed"
            value={`${qualification.confirmedReadiness}%`}
            tone="confirmed"
          />
          <StatusMetric
            label="Screened"
            value={`${qualification.screeningCoverage}%`}
            tone="screened"
          />
          <StatusMetric
            label="Checks remaining"
            value={String(qualification.checksRemaining)}
            tone="attention"
          />
          <p className="truth-boundary">
            <ShieldAlert aria-hidden="true" /> Screening indicates context, not available capacity,
            cost or delivery date.
          </p>
        </section>
        <nav className="site-workspace-tabs" aria-label="Site workspace">
          {tabs.map((item) => {
            const detail = tabDetails[item];
            const Icon = detail.icon;
            return (
              <button
                key={item}
                className={tab === item ? "active" : ""}
                aria-label={detail.label}
                aria-current={tab === item ? "page" : undefined}
                onClick={() => {
                  setDirty(false);
                  void navigate({
                    to: "/portfolio/$id",
                    params: { id },
                    search: { tab: item },
                    replace: true,
                  });
                }}
              >
                <Icon aria-hidden="true" />
                <span>
                  <b>{detail.label}</b>
                  <small>{detail.hint}</small>
                </span>
              </button>
            );
          })}
        </nav>
        <section className="site-workspace-layout">
          <div className="site-workspace-canvas" onChangeCapture={() => setDirty(true)}>
            {tab === "overview" && (
              <Overview
                property={property}
                candidateName={candidate?.nodeName ?? recommendedCandidate?.nodeName ?? null}
                candidateShortlisted={Boolean(candidate)}
                onSave={save}
              />
            )}
            {tab === "qualification" && <Qualification property={property} onSave={save} />}
            {tab === "grid" && (
              <GridWorkspace
                property={property}
                candidateName={candidate?.nodeName ?? null}
                recommendedName={recommendedCandidate?.nodeName ?? null}
                onSave={save}
              />
            )}
            {tab === "evidence" && (
              <EvidenceOperator
                property={property}
                documents={documents}
                onSave={save}
                onDocuments={refresh}
                mode="evidence"
              />
            )}
            {tab === "operator" && (
              <EvidenceOperator
                property={property}
                documents={documents}
                onSave={save}
                onDocuments={refresh}
                mode="operator"
              />
            )}
            {tab === "decision" && (
              <Decision
                property={property}
                qualificationReady={qualification.decisionReady}
                onSave={save}
              />
            )}
            <WorkspaceStepActions propertyId={property.id} current={tab} />
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function WorkspaceStepActions({ propertyId, current }: { propertyId: string; current: Tab }) {
  const index = tabs.indexOf(current);
  const previous = index > 0 ? tabs[index - 1] : null;
  const next = index < tabs.length - 1 ? tabs[index + 1] : null;
  return (
    <nav className="workspace-step-actions" aria-label="Property review steps">
      {previous ? (
        <Link to="/portfolio/$id" params={{ id: propertyId }} search={{ tab: previous }}>
          <ArrowLeft aria-hidden="true" /> Back to {tabDetails[previous].label}
        </Link>
      ) : (
        <Link to="/portfolio" search={{ view: "pipeline" }}>
          <ArrowLeft aria-hidden="true" /> Back to Portfolio
        </Link>
      )}
      {next ? (
        <Link
          className="primary-action"
          to="/portfolio/$id"
          params={{ id: propertyId }}
          search={{ tab: next }}
        >
          Next: {tabDetails[next].label}
        </Link>
      ) : (
        <Link className="primary-action" to="/portfolio" search={{ view: "decisions" }}>
          Return to Decision Review
        </Link>
      )}
    </nav>
  );
}

function StatusMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`workspace-status-metric status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Overview({
  property,
  candidateName,
  candidateShortlisted,
  onSave,
}: {
  property: AnonymousProperty;
  candidateName: string | null;
  candidateShortlisted: boolean;
  onSave: (p: AnonymousProperty) => Promise<void>;
}) {
  const profile = property.dataCentreProfile!;
  const qualification = deriveQualification(property);
  const constraints = qualification.dimensions.filter((item) => item.status === "adverse");
  const supportingReasons = [
    `${property.requiredTotalSiteLoadMw ?? property.project.importMw} MW client-declared requirement`,
    candidateName ? `${candidateName} mapped as a connection hypothesis` : null,
    property.municipality ? `${property.municipality} municipality identified` : null,
  ].filter(Boolean) as string[];
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Property Brief</p>
          <h2>Opportunity Overview</h2>
          <p>Understand the opportunity, material concerns and next investigation step.</p>
        </div>
      </header>
      <section className="overview-executive" aria-label="Executive property summary">
        <article className="overview-recommendation">
          <span>Current position</span>
          <strong>{decisionRecommendationLabel(property)}</strong>
          <p>
            {property.decisionRationale ??
              "Review the available context before recording an Advance, Hold or Reject decision."}
          </p>
        </article>
        <article>
          <span>Why investigate</span>
          <ul>
            {supportingReasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>
        <article>
          <span>Material concerns</span>
          <ul>
            {constraints.length ? (
              constraints
                .slice(0, 3)
                .map((item) => (
                  <li key={item.key}>{qualificationLabels[item.key]} constraint detected</li>
                ))
            ) : (
              <li>{qualification.checksRemaining} checks still require review or evidence.</li>
            )}
          </ul>
        </article>
      </section>
      <form
        className="workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onSave({
            ...property,
            name: String(form.get("name")),
            municipality: String(form.get("municipality")) || null,
            siteLabel: String(form.get("address")) || null,
            requiredItLoadMw: numberOrNull(form.get("itLoad")),
            requiredTotalSiteLoadMw: numberOrNull(form.get("totalLoad")),
            landControlStatus: String(form.get("land")) as AnonymousProperty["landControlStatus"],
            dataCentreProfile: {
              ...profile,
              address: String(form.get("address")) || null,
              federalState: String(form.get("state")) || null,
              cadastralReference: String(form.get("cadastre")) || null,
              siteAreaHectares: numberOrNull(form.get("area")),
              developableAreaHectares: numberOrNull(form.get("developable")),
              minimumViableLoadMw: numberOrNull(form.get("minimumMw")),
              targetEnergisationDate: String(form.get("date")) || null,
              transactionStructure: String(
                form.get("transaction"),
              ) as typeof profile.transactionStructure,
            },
          });
        }}
      >
        <section className="workspace-form-section">
          <header>
            <h3>Site identity</h3>
            <p>Location and land reference</p>
          </header>
          <div className="form-grid">
            <label>
              Site name
              <input name="name" required defaultValue={property.name} />
            </label>
            <label>
              Address / site label
              <input name="address" defaultValue={profile.address ?? ""} />
            </label>
            <label>
              Municipality
              <input name="municipality" defaultValue={property.municipality ?? ""} />
            </label>
            <label>
              Federal state
              <input name="state" defaultValue={profile.federalState ?? ""} />
            </label>
            <label>
              Cadastral reference
              <input name="cadastre" defaultValue={profile.cadastralReference ?? ""} />
            </label>
          </div>
        </section>
        <section className="workspace-form-section">
          <header>
            <h3>Scale and power</h3>
            <p>Declared requirements, not available capacity</p>
          </header>
          <div className="form-grid">
            <label>
              Site area (ha)
              <input
                name="area"
                type="number"
                min="0"
                step="0.01"
                defaultValue={profile.siteAreaHectares ?? ""}
              />
            </label>
            <label>
              Developable area (ha)
              <input
                name="developable"
                type="number"
                min="0"
                step="0.01"
                defaultValue={profile.developableAreaHectares ?? ""}
              />
            </label>
            <label>
              IT load (MW)
              <input
                name="itLoad"
                type="number"
                min="0"
                step="0.1"
                defaultValue={property.requiredItLoadMw ?? ""}
              />
            </label>
            <label>
              Total site load (MW)
              <input
                name="totalLoad"
                required
                type="number"
                min="0"
                step="0.1"
                defaultValue={property.requiredTotalSiteLoadMw ?? property.project.importMw}
              />
            </label>
            <label>
              Minimum viable load (MW)
              <input
                name="minimumMw"
                type="number"
                min="0"
                step="0.1"
                defaultValue={profile.minimumViableLoadMw ?? ""}
              />
            </label>
          </div>
        </section>
        <section className="workspace-form-section">
          <header>
            <h3>Delivery position</h3>
            <p>Commercial assumptions supplied by the client</p>
          </header>
          <div className="form-grid">
            <label>
              Target energisation
              <input name="date" type="date" defaultValue={profile.targetEnergisationDate ?? ""} />
            </label>
            <label>
              Land control
              <select name="land" defaultValue={property.landControlStatus}>
                <option value="unknown">Unknown</option>
                <option value="identified">Identified</option>
                <option value="optioned">Optioned</option>
                <option value="controlled">Controlled</option>
              </select>
            </label>
            <label>
              Transaction
              <select name="transaction" defaultValue={profile.transactionStructure}>
                <option value="unknown">Unknown</option>
                <option value="purchase">Purchase</option>
                <option value="lease">Lease</option>
                <option value="option">Option</option>
                <option value="joint_venture">Joint venture</option>
              </select>
            </label>
          </div>
        </section>
        <div className="workspace-callout">
          <Map />{" "}
          <div>
            <b>
              {candidateShortlisted ? "Shortlisted grid hypothesis" : "Recommended grid hypothesis"}
            </b>
            <span>
              {candidateName ?? "No connection hypothesis yet — continue in Power Finder."}
              {!candidateShortlisted && candidateName ? " · review before shortlisting" : ""}
            </span>
          </div>
        </div>
        <footer className="workspace-form-actions">
          <button className="primary-action" type="submit">
            <CheckCircle2 aria-hidden="true" /> Save site brief
          </button>
        </footer>
      </form>
    </>
  );
}

function Qualification({
  property,
  onSave,
}: {
  property: AnonymousProperty;
  onSave: (p: AnonymousProperty, m?: string) => Promise<void>;
}) {
  const result = deriveQualification(property);
  const [screening, setScreening] = useState(false);
  const latestRun = property.enrichmentRuns?.[0];
  const primaryKeys: QualificationDimensionKey[] = [
    "land",
    "planning",
    "grid",
    "fibre",
    "environment",
    "municipality",
  ];
  const renderDimension = (dimension: (typeof result.dimensions)[number]) => (
    <form
      key={dimension.key}
      className={`qualification-review-card status-${dimension.status}`}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const evidenceIds = form.getAll("evidence").map(String);
        void onSave(
          {
            ...property,
            qualification: updateQualificationDimension(property.qualification!, dimension.key, {
              status: String(form.get("status")) as typeof dimension.status,
              summary: String(form.get("summary")) || null,
              evidenceIds,
              reviewedAt: new Date().toISOString(),
            }),
          },
          `${qualificationLabels[dimension.key]} reviewed`,
        );
      }}
    >
      <div className="qualification-review-summary">
        <div className="qualification-review-title">
          <strong>{qualificationLabels[dimension.key]}</strong>
          <span className={`review-state state-${dimension.status}`}>{dimension.status}</span>
        </div>
        {property.screeningAssessments?.find((item) => item.dimensionKey === dimension.key) ? (
          <div className="screening-fact">
            <span>Screened Context</span>
            <p>
              {
                property.screeningAssessments.find((item) => item.dimensionKey === dimension.key)!
                  .summary
              }
            </p>
            <small>Requires client, document, or operator confirmation.</small>
          </div>
        ) : (
          <div className="screening-fact screening-fact-empty">
            <span>Information Needed</span>
            <p>No traceable source currently establishes this check.</p>
          </div>
        )}
        <small>
          {dimension.unsupported
            ? "A finding was entered without accepted confirming evidence."
            : dimension.acceptedEvidence
              ? `${dimension.acceptedEvidence} confirming evidence item(s) linked.`
              : "No confirming evidence linked."}
        </small>
      </div>
      <div className="qualification-review-controls">
        <label>
          Review outcome
          <select name="status" defaultValue={dimension.status}>
            <option value="unknown">Keep unknown</option>
            <option value="favourable">Confirmed favourable</option>
            <option value="conditional">Confirmed with conditions</option>
            <option value="adverse">Confirmed adverse</option>
          </select>
        </label>
        <label>
          Reviewer note
          <textarea
            name="summary"
            rows={2}
            placeholder="Add the confirmed finding and implications…"
            defaultValue={dimension.summary ?? ""}
          />
        </label>
        <details>
          <summary>
            Link confirming evidence
            {dimension.evidenceIds.length ? ` (${dimension.evidenceIds.length})` : ""}
          </summary>
          {(property.evidenceRegister ?? []).length ? (
            property.evidenceRegister!.map((evidence) => (
              <label key={evidence.id} className="check-label">
                <input
                  type="checkbox"
                  name="evidence"
                  value={evidence.id}
                  defaultChecked={dimension.evidenceIds.includes(evidence.id)}
                />
                {evidence.title}
              </label>
            ))
          ) : (
            <p>Add confirming material in Sources first.</p>
          )}
        </details>
        <button type="submit">Save Review</button>
      </div>
    </form>
  );
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Development review</p>
          <h2>Site Checks</h2>
          <p>
            Review prefilled screening context, link confirming evidence, and change an outcome only
            when the source supports it. Missing information remains unknown.
          </p>
        </div>
      </header>
      <section className="readiness-source-import" aria-label="Public context import">
        <div>
          <p className="context-label">Step 1 · Import available context</p>
          <h3>Prefill readiness from accepted public sources</h3>
          <p>
            Adds screened context for review. It does not confirm land control, planning, grid
            capacity, fibre service, or development feasibility.
          </p>
          {latestRun ? (
            <small>
              {latestRun.completedSources.length} sources completed ·{" "}
              {latestRun.failedSources.length} incomplete
            </small>
          ) : (
            <small>No public-source screening has been run for this site.</small>
          )}
        </div>
        <button
          type="button"
          disabled={screening}
          onClick={async () => {
            setScreening(true);
            try {
              const screened = await screenProperty(property, "manual_refresh");
              await onSave(screened, "Available public context imported");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Public context could not be imported.",
              );
            } finally {
              setScreening(false);
            }
          }}
        >
          {screening ? (
            <LoaderCircle className="spin" aria-hidden="true" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {screening
            ? "Importing…"
            : latestRun
              ? "Refresh Public Context"
              : "Import Public Context"}
        </button>
      </section>
      <div className="qualification-list">
        {result.dimensions.filter((item) => primaryKeys.includes(item.key)).map(renderDimension)}
        <details className="additional-readiness-checks">
          <summary>Additional checks</summary>
          <div>
            {result.dimensions
              .filter((item) => !primaryKeys.includes(item.key))
              .map(renderDimension)}
          </div>
        </details>
      </div>
    </>
  );
}

function GridWorkspace({
  property,
  candidateName,
  recommendedName,
  onSave,
}: {
  property: AnonymousProperty;
  candidateName: string | null;
  recommendedName: string | null;
  onSave: (p: AnonymousProperty, m?: string) => Promise<void>;
}) {
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Connection hypotheses</p>
          <h2>Power Options</h2>
          <p>
            Power Finder remains the single screening engine. This page summarises its saved output.
          </p>
        </div>
        <Link
          className="primary-action grid-open-finder"
          to="/power-finder"
          search={{
            propertyId: property.id,
            lng: property.project.longitude,
            lat: property.project.latitude,
            mw: property.project.importMw,
            projectType: property.project.type,
            candidate: property.preferredCandidateId ?? undefined,
          }}
        >
          <Map aria-hidden="true" /> Investigate on Map
        </Link>
      </header>
      <div className="grid-truth-note">
        <ShieldAlert aria-hidden="true" />
        <span>
          Candidate ranking is an investigation aid. Capacity, feasibility, cost, and programme
          require operator confirmation.
        </span>
      </div>
      <div className="workspace-facts">
        <article>
          <span>Recommended for investigation</span>
          <strong>{recommendedName ?? "Not screened"}</strong>
          <small>Not a capacity offer.</small>
        </article>
        <article>
          <span>Shortlisted candidate</span>
          <strong>{candidateName ?? "Not selected"}</strong>
        </article>
        <article>
          <span>Candidate snapshots</span>
          <strong>{property.candidateSnapshots.length}</strong>
        </article>
        <article>
          <span>Likely operator</span>
          <strong>{property.operatorEngagement!.operatorName ?? "Unconfirmed"}</strong>
        </article>
        <article>
          <span>Capacity</span>
          <strong>
            {property.evidence?.validationStatus === "validated"
              ? "Validated evidence"
              : "Not established"}
          </strong>
        </article>
      </div>
      <div className="grid-candidate-heading">
        <div>
          <p className="context-label">Mapped alternatives</p>
          <h3>Candidate comparison</h3>
        </div>
        {property.recommendedCandidateId &&
        property.recommendedCandidateId !== property.preferredCandidateId ? (
          <button
            type="button"
            className="primary-action shortlist-candidate-action"
            onClick={() =>
              void onSave(
                {
                  ...property,
                  preferredCandidateId: property.recommendedCandidateId ?? null,
                  selectedCandidateIds: Array.from(
                    new Set([...property.selectedCandidateIds, property.recommendedCandidateId!]),
                  ),
                  gridScreeningSnapshots: (property.gridScreeningSnapshots ?? []).map(
                    (snapshot, index) =>
                      index === 0
                        ? {
                            ...snapshot,
                            shortlistedCandidateId: property.recommendedCandidateId ?? null,
                          }
                        : snapshot,
                  ),
                },
                "Recommended connection hypothesis shortlisted",
              )
            }
          >
            Shortlist recommended candidate
          </button>
        ) : null}
      </div>
      <div className="candidate-table" role="table" aria-label="Grid candidate comparison">
        <div className="candidate-table-head" role="row">
          <span>Candidate</span>
          <span>Distance</span>
          <span>Likely operator</span>
          <span>Status</span>
        </div>
        {property.candidateSnapshots.map((item) => (
          <div
            role="row"
            key={item.id}
            className={item.id === property.preferredCandidateId ? "preferred" : ""}
          >
            <strong>{item.nodeName}</strong>
            <span>{item.distanceKm.toFixed(1)} km</span>
            <span>{item.operator ?? "Operator unknown"}</span>
            <span>{item.id === property.preferredCandidateId ? "Preferred" : "Alternative"}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function EvidenceOperator({
  property,
  documents,
  onSave,
  onDocuments,
  mode,
}: {
  property: AnonymousProperty;
  documents: AnonymousDocumentMetadata[];
  onSave: (p: AnonymousProperty, m?: string) => Promise<void>;
  onDocuments: () => Promise<void>;
  mode: "evidence" | "operator";
}) {
  const engagement = property.operatorEngagement!;
  const addEvidence = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const item: AnonymousEvidenceItem = {
      id: crypto.randomUUID(),
      category: String(form.get("category")) as AnonymousEvidenceItem["category"],
      title: String(form.get("title")),
      claim: String(form.get("claim")),
      evidenceClass: String(form.get("class")) as AnonymousEvidenceItem["evidenceClass"],
      validationStatus: String(form.get("validation")) as AnonymousEvidenceItem["validationStatus"],
      sourceOrganisation: String(form.get("organisation")) || null,
      sourceReference: String(form.get("reference")) || null,
      sourceUrl: null,
      documentId: String(form.get("document")) || null,
      issuedAt: null,
      validFrom: null,
      validTo: String(form.get("validTo")) || null,
      limitations: [],
      relatedDimensionKeys: [],
      createdAt: now,
      updatedAt: now,
    };
    void onSave(
      {
        ...property,
        evidenceRegister: [...(property.evidenceRegister ?? []), item],
        operatorEngagement:
          item.category === "operator"
            ? { ...engagement, evidenceIds: [...engagement.evidenceIds, item.id] }
            : engagement,
      },
      "Evidence added",
    );
    event.currentTarget.reset();
  };
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Traceable property record</p>
          <h2>{mode === "evidence" ? "Sources" : "Enquiries"}</h2>
          <p>
            {mode === "evidence"
              ? "Review public findings, client declarations and supporting documents without merging their provenance."
              : "Track external confirmation work and record only information sent or received."}
          </p>
        </div>
      </header>
      {mode === "evidence" ? <PropertyEnrichmentPanel property={property} onSave={onSave} /> : null}
      <div hidden={mode !== "operator"}>
        <section className="operator-panel">
          <header className="operator-panel-heading">
            <div>
              <p className="context-label">Prefilled from the shortlisted grid hypothesis</p>
              <h3>Operator enquiry</h3>
              <p>Confirm the suggested operator, then record only information sent or received.</p>
            </div>
            <div className="operator-context-facts">
              <span>
                Requested load
                <b>{property.requiredTotalSiteLoadMw ?? property.project.importMw} MW</b>
              </span>
              <span>
                Suggested operator
                <b>{engagement.operatorName ?? "Unknown"}</b>
              </span>
            </div>
          </header>
          <form
            className="form-grid operator-review-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onSave(
                {
                  ...property,
                  operatorEngagement: {
                    ...engagement,
                    operatorName: String(form.get("operator")) || null,
                    operatorLevel: String(form.get("level")) as typeof engagement.operatorLevel,
                    responsibilityStatus: String(
                      form.get("responsibility"),
                    ) as typeof engagement.responsibilityStatus,
                    enquiryStatus: String(form.get("status")) as typeof engagement.enquiryStatus,
                    enquiryReference: String(form.get("reference")) || null,
                    submittedAt: String(form.get("submitted")) || null,
                    nextAction: String(form.get("next")) || null,
                    nextActionDueAt: String(form.get("due")) || null,
                    indicatedConnectionPoint: String(form.get("connection")) || null,
                    indicatedCapacityMw: numberOrNull(form.get("capacity")),
                    indicatedCostEur: numberOrNull(form.get("cost")),
                    indicatedDeliveryDate: String(form.get("delivery")) || null,
                  },
                },
                "Operator engagement saved",
              );
            }}
          >
            <label>
              Operator
              <input name="operator" defaultValue={engagement.operatorName ?? ""} />
            </label>
            <label>
              Level
              <select name="level" defaultValue={engagement.operatorLevel}>
                <option value="unknown">Unknown</option>
                <option value="dso">DSO</option>
                <option value="tso">TSO</option>
              </select>
            </label>
            <label>
              Responsibility
              <select name="responsibility" defaultValue={engagement.responsibilityStatus}>
                <option value="screening_only">Screening only</option>
                <option value="customer_confirmed">Customer confirmed</option>
                <option value="operator_confirmed">Operator confirmed</option>
              </select>
            </label>
            <label>
              Enquiry status
              <select name="status" defaultValue={engagement.enquiryStatus}>
                <option value="not_started">Not started</option>
                <option value="preparing">Preparing</option>
                <option value="submitted">Submitted</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="response_received">Response received</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label>
              Enquiry reference
              <input name="reference" defaultValue={engagement.enquiryReference ?? ""} />
            </label>
            <label>
              Submitted
              <input name="submitted" type="date" defaultValue={engagement.submittedAt ?? ""} />
            </label>
            <label>
              Indicated connection point
              <input name="connection" defaultValue={engagement.indicatedConnectionPoint ?? ""} />
            </label>
            <label>
              Indicated capacity (MW)
              <input
                name="capacity"
                type="number"
                min="0"
                step="0.1"
                defaultValue={engagement.indicatedCapacityMw ?? ""}
              />
            </label>
            <label>
              Indicated cost (€)
              <input
                name="cost"
                type="number"
                min="0"
                step="1"
                defaultValue={engagement.indicatedCostEur ?? ""}
              />
            </label>
            <label>
              Indicated delivery date
              <input
                name="delivery"
                type="date"
                defaultValue={engagement.indicatedDeliveryDate ?? ""}
              />
            </label>
            <label>
              Next action
              <input name="next" defaultValue={engagement.nextAction ?? ""} />
            </label>
            <label>
              Due date
              <input name="due" type="date" defaultValue={engagement.nextActionDueAt ?? ""} />
            </label>
            <button type="submit" className="primary-action">
              Save Enquiry
            </button>
          </form>
        </section>
        <Correspondence property={property} onSave={onSave} />
      </div>
      <div className="evidence-grid" hidden={mode !== "evidence"}>
        <section>
          <div className="evidence-register-heading">
            <div>
              <h3>Evidence register</h3>
              <p>Public screening, client declarations, and operator evidence remain distinct.</p>
            </div>
            <span>{(property.evidenceRegister ?? []).length} items</span>
          </div>
          <details className="evidence-add-disclosure">
            <summary>
              <Plus aria-hidden="true" /> Add Client or Operator Evidence
            </summary>
            <form className="evidence-add-form" onSubmit={addEvidence}>
              <input name="title" required placeholder="Evidence title…" />
              <textarea name="claim" required placeholder="Claim supported by this evidence…" />
              <div className="form-grid">
                <label>
                  Category
                  <select name="category">
                    <option value="grid">Grid</option>
                    <option value="operator">Operator</option>
                    <option value="planning">Planning</option>
                    <option value="property">Property</option>
                    <option value="fibre">Fibre</option>
                    <option value="environment">Environment</option>
                    <option value="municipality">Municipality</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </label>
                <label>
                  Class
                  <select name="class">
                    <option value="customer_declared">Customer declared</option>
                    <option value="public_source">Public source</option>
                    <option value="derived">Derived</option>
                    <option value="operator_confirmed">Operator confirmed</option>
                  </select>
                </label>
                <label>
                  Validation
                  <select name="validation">
                    <option value="unverified">Unverified</option>
                    <option value="collected">Collected</option>
                    <option value="validated">Validated</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </label>
                <label>
                  Source organisation
                  <input name="organisation" />
                </label>
                <label>
                  Reference
                  <input name="reference" />
                </label>
                <label>
                  Valid to
                  <input name="validTo" type="date" />
                </label>
                <label>
                  Document
                  <select name="document">
                    <option value="">No document</option>
                    {documents.map((document) => (
                      <option value={document.id} key={document.id}>
                        {document.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit">
                <Plus /> Add evidence
              </button>
            </form>
          </details>
          <div className="evidence-register">
            {(property.evidenceRegister ?? []).map((item) => (
              <article key={item.id}>
                <div>
                  <b>{item.title}</b>
                  <span>
                    {item.evidenceClass.replaceAll("_", " ")} · {item.validationStatus}
                  </span>
                </div>
                <p>{item.claim}</p>
                <button
                  aria-label={`Delete ${item.title}`}
                  onClick={() =>
                    void onSave(
                      {
                        ...property,
                        evidenceRegister: property.evidenceRegister!.filter(
                          (evidence) => evidence.id !== item.id,
                        ),
                        qualification: property.qualification!.map((dimension) => ({
                          ...dimension,
                          evidenceIds: dimension.evidenceIds.filter((id) => id !== item.id),
                        })),
                      },
                      "Evidence removed",
                    )
                  }
                >
                  <Trash2 />
                </button>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h3>Documents</h3>
          <label className="document-upload">
            <Upload />
            <span>
              Attach PDF, image or supporting file
              <small>Stored only in this browser · maximum 20 MB</small>
            </span>
            <input
              type="file"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await saveAnonymousDocument(property.id, file);
                  await onDocuments();
                  toast.success("Document stored on this device");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Upload failed");
                }
                event.target.value = "";
              }}
            />
          </label>
          <div className="document-list">
            {documents.map((document) => (
              <article key={document.id}>
                <FileText />
                <div>
                  <b>{document.name}</b>
                  <span>
                    {(document.size / 1024).toFixed(0)} KB · SHA-256 {document.hash.slice(0, 10)}…
                  </span>
                </div>
                <button
                  aria-label={`Delete ${document.name}`}
                  onClick={async () => {
                    await deleteAnonymousDocument(document.id);
                    await onDocuments();
                  }}
                >
                  <Trash2 />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Correspondence({
  property,
  onSave,
}: {
  property: AnonymousProperty;
  onSave: (property: AnonymousProperty, message?: string) => Promise<void>;
}) {
  const engagement = property.operatorEngagement!;
  return (
    <section className="correspondence-panel">
      <header>
        <div>
          <p className="context-label">Traceable contact history</p>
          <h3>Engagement timeline</h3>
        </div>
        <span>{engagement.correspondence.length} interactions</span>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const entry = {
            id: crypto.randomUUID(),
            occurredAt: String(form.get("occurredAt")),
            channel: String(form.get("channel")) as
              | "email"
              | "letter"
              | "call"
              | "meeting"
              | "portal",
            direction: String(form.get("direction")) as "outbound" | "inbound" | "internal",
            subject: String(form.get("subject")),
            summary: String(form.get("summary")),
          };
          void onSave(
            {
              ...property,
              operatorEngagement: {
                ...engagement,
                correspondence: [...engagement.correspondence, entry],
              },
            },
            "Interaction recorded",
          );
          event.currentTarget.reset();
        }}
      >
        <label>
          Date
          <input name="occurredAt" type="date" required />
        </label>
        <label>
          Channel
          <select name="channel">
            <option value="email">Email</option>
            <option value="letter">Letter</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="portal">Portal</option>
          </select>
        </label>
        <label>
          Direction
          <select name="direction">
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
            <option value="internal">Internal</option>
          </select>
        </label>
        <label className="correspondence-subject">
          Subject
          <input name="subject" required />
        </label>
        <label className="correspondence-outcome">
          Outcome or commitment
          <input name="summary" required />
        </label>
        <button type="submit">
          <Plus aria-hidden="true" /> Record interaction
        </button>
      </form>
      <div>
        {[...engagement.correspondence]
          .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
          .map((item) => (
            <article key={item.id}>
              <time>{item.occurredAt}</time>
              <div>
                <b>{item.subject}</b>
                <span>
                  {item.channel} · {item.direction}
                </span>
                <p>{item.summary}</p>
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

function Decision({
  property,
  qualificationReady,
  onSave,
}: {
  property: AnonymousProperty;
  qualificationReady: boolean;
  onSave: (p: AnonymousProperty, m?: string) => Promise<void>;
}) {
  const nonReviewable = property.decisionStatus !== "unreviewed";
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Controlled recommendation</p>
          <h2>Decision</h2>
          <p>
            The recommendation records what the team knows now. It does not replace technical or
            operator due diligence.
          </p>
        </div>
      </header>
      {!qualificationReady && (
        <div className="workspace-warning">
          <ShieldAlert />
          <div>
            <b>Qualification is incomplete</b>
            <span>
              You may record a provisional decision, but critical unknowns and unsupported findings
              remain visible.
            </span>
          </div>
        </div>
      )}
      <section className="decision-gate-summary" aria-label="Decision evidence summary">
        <article>
          <span>Accepted evidence</span>
          <strong>
            {
              (property.evidenceRegister ?? []).filter(
                (item) => item.validationStatus === "validated",
              ).length
            }
          </strong>
        </article>
        <article>
          <span>Power candidate</span>
          <strong>
            {property.preferredCandidateId ? "Explicitly shortlisted" : "Not shortlisted"}
          </strong>
        </article>
        <article>
          <span>Operator response</span>
          <strong>
            {property.operatorEngagement?.enquiryStatus.replaceAll("_", " ") ?? "Not started"}
          </strong>
        </article>
        <article>
          <span>Capacity</span>
          <strong>
            {property.operatorEngagement?.indicatedCapacityMw != null
              ? "Operator-indicated"
              : "Not established"}
          </strong>
        </article>
      </section>
      <form
        className="decision-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const status = String(form.get("decision")) as AnonymousProperty["decisionStatus"];
          const rationale = String(form.get("rationale")).trim();
          if (status !== "unreviewed" && rationale.length < 10)
            return toast.error("Add a decision rationale of at least 10 characters.");
          const changed =
            status !== property.decisionStatus || rationale !== (property.decisionRationale ?? "");
          const decisionEvent = changed
            ? {
                id: crypto.randomUUID(),
                previousStatus: property.decisionStatus,
                status,
                provisional: status === "advance" && !qualificationReady,
                rationale: rationale || null,
                preferredCandidateId: property.preferredCandidateId,
                evidenceIds: (property.evidenceRegister ?? [])
                  .filter((item) => item.validationStatus === "validated")
                  .map((item) => item.id),
                actorLabel: "Local workspace",
                recordedAt: new Date().toISOString(),
              }
            : null;
          setSaving(true);
          try {
            await onSave(
              {
                ...property,
                decisionStatus: status,
                decisionRationale: rationale || null,
                decisionEvents: decisionEvent
                  ? [...(property.decisionEvents ?? []), decisionEvent]
                  : property.decisionEvents,
              },
              "Decision recorded",
            );
            setSavedAt(new Date().toISOString());
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Decision could not be saved.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset>
          <legend>Recommendation</legend>
          {(["unreviewed", "advance", "hold", "reject"] as const).map((status) => (
            <label key={status}>
              <input
                type="radio"
                name="decision"
                value={status}
                defaultChecked={property.decisionStatus === status}
              />
              <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </label>
          ))}
        </fieldset>
        <label>
          Decision rationale
          <textarea
            name="rationale"
            rows={6}
            required={nonReviewable}
            defaultValue={property.decisionRationale ?? ""}
            placeholder="State the evidence, material risks, and reason for this recommendation…"
          />
        </label>
        <button className="primary-action" type="submit" disabled={saving}>
          <CheckCircle2 aria-hidden="true" /> {saving ? "Saving…" : "Save Recommendation"}
        </button>
        <p className="decision-save-status" aria-live="polite">
          {savedAt
            ? `Saved in this browser at ${new Intl.DateTimeFormat(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(savedAt))}. Reloading will preserve this recommendation.`
            : "Not saved in this review session yet."}
        </p>
        <Link className="secondary-action" to="/capacity-dossiers/$id" params={{ id: property.id }}>
          <Paperclip /> Open client decision record
        </Link>
      </form>
    </>
  );
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
