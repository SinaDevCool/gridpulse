import { Link } from "@tanstack/react-router";

import { CheckCircle2,Paperclip,ShieldAlert } from "lucide-react";

import { useState } from "react";

import { toast } from "sonner";

import { type AnonymousProperty } from "@/features/anonymous-workspace/schema";

export function Decision({
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
