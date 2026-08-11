import { Check, Database, LoaderCircle, Pencil, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import { reviewEnrichmentFinding } from "./property-enrichment";
import { screenProperty } from "./property-screening-workflow";

export function PropertyEnrichmentPanel({
  property,
  onSave,
}: {
  property: AnonymousProperty;
  onSave: (property: AnonymousProperty, message?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const proposed = (property.enrichmentFindings ?? []).filter((item) => item.status === "proposed");
  const reviewed = (property.enrichmentFindings ?? []).filter((item) =>
    ["accepted", "edited", "rejected"].includes(item.status),
  );
  async function run() {
    setBusy(true);
    try {
      const failedSources = property.enrichmentRuns?.[0]?.sourceResults
        .filter((result) => !["succeeded", "not_covered"].includes(result.status))
        .map((result) => result.source);
      const screened = await screenProperty(
        property,
        "manual_refresh",
        undefined,
        failedSources?.length ? Array.from(new Set(failedSources)) : undefined,
      );
      await onSave(screened, "Public context and grid screening refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enrichment failed");
    } finally {
      setBusy(false);
    }
  }
  async function decide(id: string, decision: "accept" | "edit" | "reject") {
    try {
      await onSave(
        reviewEnrichmentFinding(
          property,
          id,
          decision,
          decision === "edit" ? editValue : undefined,
        ),
        decision === "reject" ? "Finding rejected" : "Finding accepted as evidence",
      );
      setEditing(null);
      setEditValue("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Finding could not be reviewed");
    }
  }
  return (
    <section className="workspace-card enrichment-review" aria-labelledby="enrichment-heading">
      <header className="workspace-card-heading">
        <div>
          <p className="context-label">Source-attributed public context</p>
          <h3 id="enrichment-heading">Automatic site enrichment</h3>
          <p>Review every proposed finding before it changes this site or counts as evidence.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? (
            <LoaderCircle className="spin" aria-hidden="true" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {busy
            ? "Enriching…"
            : property.enrichmentRuns?.[0]?.failedSources.length
              ? "Retry incomplete sources"
              : property.enrichmentRuns?.length
                ? "Refresh context"
                : "Enrich site"}
        </button>
      </header>
      {property.enrichmentRuns?.[0] ? (
        <div className="enrichment-run-summary" role="status">
          <Database aria-hidden="true" />
          <span>{property.enrichmentRuns[0].completedSources.length} sources completed</span>
          <span>{property.enrichmentRuns[0].failedSources.length} incomplete</span>
          <span>{proposed.length} awaiting review</span>
        </div>
      ) : (
        <p className="empty-context">No enrichment has been run for this site.</p>
      )}
      <div className="enrichment-findings">
        {proposed.map((finding) => (
          <article key={finding.id}>
            <div className="enrichment-finding-copy">
              <span>
                {finding.source.replaceAll("_", " ")} · {finding.confidence} confidence
              </span>
              <strong>{finding.title}</strong>
              {editing === finding.id ? (
                <input
                  aria-label={`Reviewed value for ${finding.title}`}
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                />
              ) : (
                <p>{finding.displayValue}</p>
              )}
              <small>
                {finding.sourceOrganisation} · {finding.method.replaceAll("_", " ")} · release{" "}
                {finding.releaseId.slice(0, 12)}
              </small>
              <small>{finding.limitations.join(" ")}</small>
            </div>
            <div className="enrichment-actions">
              <button
                type="button"
                aria-label={`Accept ${finding.title}`}
                onClick={() => void decide(finding.id, "accept")}
              >
                <Check aria-hidden="true" /> Accept
              </button>
              {editing === finding.id ? (
                <button type="button" onClick={() => void decide(finding.id, "edit")}>
                  <Check aria-hidden="true" /> Accept edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(finding.id);
                    setEditValue(String(finding.proposedValue ?? ""));
                  }}
                >
                  <Pencil aria-hidden="true" /> Edit
                </button>
              )}
              <button
                type="button"
                aria-label={`Reject ${finding.title}`}
                onClick={() => void decide(finding.id, "reject")}
              >
                <X aria-hidden="true" /> Reject
              </button>
            </div>
          </article>
        ))}
      </div>
      {reviewed.length ? (
        <p className="enrichment-reviewed-count">
          {reviewed.length} findings reviewed; accepted findings are preserved in the evidence
          register.
        </p>
      ) : null}
    </section>
  );
}
