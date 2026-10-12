import { LoaderCircle,RefreshCw } from "lucide-react";

import { useState } from "react";

import { toast } from "sonner";

import {
type AnonymousProperty,
type QualificationDimensionKey,
} from "@/features/anonymous-workspace/schema";

import {
deriveQualification,
qualificationLabels,
updateQualificationDimension,
} from "@/features/anonymous-workspace/data-centre-qualification";

import { screenProperty } from "@/features/properties/property-screening-workflow";

export function Qualification({
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
