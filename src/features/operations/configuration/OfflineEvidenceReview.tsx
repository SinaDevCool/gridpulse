import { useRef, useState } from "react";
import { z } from "zod";
const reviewSchema = z.object({
  schema_version: z.literal("gridpulse-component-intake-review-v1"),
  dataset_id: z.string().max(200),
  capture_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  quality_accepted: z.boolean(),
  blockers: z.array(z.string().max(300)).max(100),
  calibrated: z.literal(false),
  activated: z.literal(false),
  automatic_live_dispatch_authorized: z.literal(false),
});
/** Local report inspection only: this component has no upload or job submission path. */
export function OfflineEvidenceReview() {
  const [report, setReport] = useState<z.infer<typeof reviewSchema> | null>(
      null,
    ),
    [error, setError] = useState("");
  const sequence = useRef(0);
  return (
    <section aria-label="Offline evidence review">
      <h4>Offline quality report</h4>
      <p>
        Inspect an Engine component-intake review locally. This does not import
        measurements into the planner or send this file to the server.
      </p>
      <input
        type="file"
        accept=".json,application/json"
        aria-label="Offline quality report JSON"
        onChange={async (event) => {
          const ticket = ++sequence.current,
            file = event.currentTarget.files?.[0];
          setReport(null);
          setError("");
          if (!file) return;
          try {
            if (file.size > 16 * 1024 * 1024)
              throw new Error("Review exceeds 16 MB.");
            const parsed = reviewSchema.parse(JSON.parse(await file.text()));
            if (ticket === sequence.current) setReport(parsed);
          } catch (reason) {
            if (ticket === sequence.current)
              setError(
                reason instanceof Error ? reason.message : "Invalid report",
              );
          }
        }}
      />
      {error ? <p role="alert">{error}</p> : null}
      {report ? (
        <>
          <p>Dataset: {report.dataset_id}</p>
          <p>
            Declared sample quality:{" "}
            {report.quality_accepted ? "checks passed" : "checks failed"}
          </p>
          <ul>
            {report.blockers.map((b) => (
              <li key={b}>{b.replaceAll("_", " ")}</li>
            ))}
          </ul>
          <small>
            Capture identity: {report.capture_sha256}. Source authenticity and
            permission require independent review. Not calibrated, activated or
            operationally approved.
          </small>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              ++sequence.current;
              setReport(null);
            }}
          >
            Clear report
          </button>
        </>
      ) : null}
    </section>
  );
}
