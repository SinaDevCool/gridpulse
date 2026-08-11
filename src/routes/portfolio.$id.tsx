import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Map,
  Paperclip,
  Plus,
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
  operatorReadiness,
  qualificationLabels,
  updateQualificationDimension,
} from "@/features/anonymous-workspace/data-centre-qualification";
import { preferredCandidate } from "@/features/anonymous-workspace/portfolio-projection";

const tabs = ["overview", "qualification", "grid", "evidence", "decision"] as const;
type Tab = (typeof tabs)[number];

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
  const save = async (next: AnonymousProperty, message = "Site saved") => {
    const updated = migrateAnonymousProperty({ ...next, updatedAt: new Date().toISOString() });
    await saveAnonymousProperty(updated);
    setProperty(updated);
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
          <Link to="/portfolio">Return to Site Pipeline</Link>
        </main>
      </AppShell>
    );
  const qualification = deriveQualification(property);
  const operator = operatorReadiness(property);
  const candidate = preferredCandidate(property);
  return (
    <AppShell>
      <main id="main-content" className="site-workspace-page">
        <header className="site-workspace-header">
          <Link to="/portfolio" className="back-link">
            <ArrowLeft /> Site Pipeline
          </Link>
          <div>
            <p className="context-label">Data Centre Opportunity</p>
            <h1>{property.name}</h1>
            <p>
              {property.siteLabel ?? property.municipality ?? "Location not labelled"} ·{" "}
              {property.requiredTotalSiteLoadMw ?? property.project.importMw} MW declared
            </p>
          </div>
          <div className={`decision-badge decision-${property.decisionStatus}`}>
            {property.decisionStatus.replace("unreviewed", "Unreviewed")}
          </div>
        </header>
        <nav className="site-workspace-tabs" aria-label="Site workspace">
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() =>
                void navigate({
                  to: "/portfolio/$id",
                  params: { id },
                  search: { tab: item },
                  replace: true,
                })
              }
            >
              {item === "evidence" ? "Evidence & operator" : item}
            </button>
          ))}
        </nav>
        <section className="site-workspace-layout">
          <aside className="site-workspace-summary">
            <Readiness label="Site qualification" value={qualification.readiness} />
            <Readiness label="Operator readiness" value={operator.score} />
            <dl>
              <div>
                <dt>Critical blockers</dt>
                <dd>{qualification.criticalBlockers.length}</dd>
              </div>
              <div>
                <dt>Unknown dimensions</dt>
                <dd>{qualification.unknown.length}</dd>
              </div>
              <div>
                <dt>Evidence items</dt>
                <dd>{property.evidenceRegister?.length ?? 0}</dd>
              </div>
              <div>
                <dt>Documents</dt>
                <dd>{documents.length}</dd>
              </div>
            </dl>
            <p className="truth-boundary">
              <ShieldAlert /> Grid proximity and screening evidence do not establish capacity, cost
              or delivery date.
            </p>
          </aside>
          <div className="site-workspace-canvas">
            {tab === "overview" && (
              <Overview
                property={property}
                candidateName={candidate?.nodeName ?? null}
                onSave={save}
              />
            )}
            {tab === "qualification" && <Qualification property={property} onSave={save} />}
            {tab === "grid" && (
              <GridWorkspace property={property} candidateName={candidate?.nodeName ?? null} />
            )}
            {tab === "evidence" && (
              <EvidenceOperator
                property={property}
                documents={documents}
                onSave={save}
                onDocuments={refresh}
              />
            )}
            {tab === "decision" && (
              <Decision
                property={property}
                qualificationReady={qualification.decisionReady}
                onSave={save}
              />
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function Readiness({ label, value }: { label: string; value: number }) {
  return (
    <div className="workspace-readiness">
      <span>{label}</span>
      <strong>{value}%</strong>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Overview({
  property,
  candidateName,
  onSave,
}: {
  property: AnonymousProperty;
  candidateName: string | null;
  onSave: (p: AnonymousProperty) => Promise<void>;
}) {
  const profile = property.dataCentreProfile!;
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Site Brief</p>
          <h2>Opportunity overview</h2>
        </div>
      </header>
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
        <div className="workspace-callout">
          <Map />{" "}
          <div>
            <b>Preferred grid route</b>
            <span>{candidateName ?? "No candidate selected — continue in Power Finder."}</span>
          </div>
        </div>
        <button className="primary-action" type="submit">
          <CheckCircle2 /> Save site brief
        </button>
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
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Evidence-led review</p>
          <h2>Data-centre qualification</h2>
          <p>
            Record the current finding for each development dimension. Non-unknown findings need
            linked evidence to count towards readiness.
          </p>
        </div>
      </header>
      <div className="qualification-list">
        {result.dimensions.map((dimension) => (
          <form
            key={dimension.key}
            className={`qualification-row status-${dimension.status}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const evidenceIds = form.getAll("evidence").map(String);
              void onSave(
                {
                  ...property,
                  qualification: updateQualificationDimension(
                    property.qualification!,
                    dimension.key,
                    {
                      status: String(form.get("status")) as typeof dimension.status,
                      summary: String(form.get("summary")) || null,
                      evidenceIds,
                      reviewedAt: new Date().toISOString(),
                    },
                  ),
                },
                `${qualificationLabels[dimension.key]} reviewed`,
              );
            }}
          >
            <div>
              <strong>{qualificationLabels[dimension.key]}</strong>
              <small>
                {dimension.unsupported
                  ? "Finding needs accepted evidence"
                  : dimension.acceptedEvidence
                    ? `${dimension.acceptedEvidence} accepted evidence item(s)`
                    : "Not evidenced"}
              </small>
            </div>
            <select name="status" defaultValue={dimension.status}>
              <option value="unknown">Unknown</option>
              <option value="favourable">Favourable</option>
              <option value="conditional">Conditional</option>
              <option value="adverse">Adverse</option>
            </select>
            <textarea
              name="summary"
              rows={2}
              placeholder="Concise finding and implications"
              defaultValue={dimension.summary ?? ""}
            />
            <details>
              <summary>Link evidence</summary>
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
                <p>Add evidence in Evidence & operator.</p>
              )}
            </details>
            <button type="submit">Save</button>
          </form>
        ))}
      </div>
    </>
  );
}

function GridWorkspace({
  property,
  candidateName,
}: {
  property: AnonymousProperty;
  candidateName: string | null;
}) {
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Connection hypothesis</p>
          <h2>Grid connection</h2>
          <p>
            Power Finder remains the single screening engine. This page summarises its saved output.
          </p>
        </div>
        <Link
          className="primary-action"
          to="/power-finder"
          search={{
            lng: property.project.longitude,
            lat: property.project.latitude,
            candidate: property.preferredCandidateId ?? undefined,
          }}
        >
          <Map /> Open Power Finder
        </Link>
      </header>
      <div className="workspace-facts">
        <article>
          <span>Preferred candidate</span>
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
      <div className="candidate-table">
        {property.candidateSnapshots.map((item) => (
          <div
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
}: {
  property: AnonymousProperty;
  documents: AnonymousDocumentMetadata[];
  onSave: (p: AnonymousProperty, m?: string) => Promise<void>;
  onDocuments: () => Promise<void>;
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
          <p className="context-label">Traceable evidence</p>
          <h2>Evidence and operator engagement</h2>
        </div>
      </header>
      <section className="operator-panel">
        <h3>Operator enquiry</h3>
        <form
          className="form-grid"
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
            Save operator engagement
          </button>
        </form>
      </section>
      <Correspondence property={property} onSave={onSave} />
      <div className="evidence-grid">
        <section>
          <h3>Evidence register</h3>
          <form className="evidence-add-form" onSubmit={addEvidence}>
            <input name="title" required placeholder="Evidence title" />
            <textarea name="claim" required placeholder="Claim supported by this evidence" />
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
      <h3>Engagement timeline</h3>
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
        <input name="occurredAt" type="date" required />
        <select name="channel">
          <option value="email">Email</option>
          <option value="letter">Letter</option>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="portal">Portal</option>
        </select>
        <select name="direction">
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
          <option value="internal">Internal</option>
        </select>
        <input name="subject" required placeholder="Subject" />
        <input name="summary" required placeholder="Outcome or commitment" />
        <button type="submit">
          <Plus /> Record
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
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Controlled recommendation</p>
          <h2>Site decision</h2>
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
      <form
        className="decision-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const status = String(form.get("decision")) as AnonymousProperty["decisionStatus"];
          const rationale = String(form.get("rationale")).trim();
          if (status !== "unreviewed" && rationale.length < 10)
            return toast.error("Add a decision rationale of at least 10 characters.");
          void onSave(
            { ...property, decisionStatus: status, decisionRationale: rationale || null },
            "Decision recorded",
          );
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
              <span>{status}</span>
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
            placeholder="State the evidence, material risks and reason for this recommendation."
          />
        </label>
        <button className="primary-action" type="submit">
          <CheckCircle2 /> Save recommendation
        </button>
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
