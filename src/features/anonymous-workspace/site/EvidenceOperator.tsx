import { FileText,Plus,Trash2,Upload } from "lucide-react";

import { type FormEvent } from "react";

import { toast } from "sonner";

import {
deleteAnonymousDocument,
saveAnonymousDocument,
} from "@/features/anonymous-workspace/repository";

import {
type AnonymousDocumentMetadata,
type AnonymousEvidenceItem,
type AnonymousProperty,
} from "@/features/anonymous-workspace/schema";

import { PropertyEnrichmentPanel } from "@/features/properties/PropertyEnrichmentPanel";

import { numberOrNull } from "./presentation";

import { Correspondence } from "./Correspondence";

export function EvidenceOperator({
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
                <Plus aria-hidden="true" /> <span>Add Evidence</span>
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
