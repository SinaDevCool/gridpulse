import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardCheck, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  AssessmentDocument,
  CandidateSite,
  OperatorCorrespondence,
  OperatorRequirement,
} from "@/lib/assessment-model";
import { assessOperatorQualification } from "./operator-qualification";

type Props = {
  site: CandidateSite;
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  correspondence: OperatorCorrespondence[];
};

export function OperatorQualificationPanel({
  site,
  requirements,
  documents,
  correspondence,
}: Props) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: [
      "operator-qualification",
      site.id,
      site.updated_at,
      requirements.map((item) => `${item.id}:${item.status}`).join("|"),
      documents.map((item) => `${item.id}:${item.review_status}`).join("|"),
      correspondence.length,
    ],
    queryFn: async () => {
      const [candidates, engagements] = await Promise.all([
        supabase
          .from("project_connection_candidates")
          .select("id", { count: "exact", head: true })
          .eq("site_id", site.id)
          .eq("status", "preferred"),
        supabase
          .from("operator_engagements")
          .select("id", { count: "exact", head: true })
          .eq("site_id", site.id),
      ]);
      if (candidates.error) throw candidates.error;
      if (engagements.error) throw engagements.error;
      return assessOperatorQualification({
        site,
        requirements,
        documents,
        correspondence,
        preferredCandidateCount: candidates.count ?? 0,
        engagementCount: engagements.count ?? 0,
      });
    },
  });

  async function captureGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.data) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const result = await supabase.rpc("capture_project_decision_snapshot", {
      p_site_id: site.id,
      p_snapshot_type: "operator_submission",
      p_decision_label: data.get("decision"),
      p_decision_rationale: data.get("rationale"),
    });
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    form.reset();
    toast.success("Qualification gate captured");
    await client.invalidateQueries({ queryKey: ["decision-snapshots", site.id] });
  }

  const result = query.data;
  return (
    <section className="workspace-card qualification-panel">
      <div className="panel-heading">
        <div>
          <p className="context-label">Phase 3 · operator-ready qualification</p>
          <h2>Connection Qualification Gate</h2>
          <p>
            Consolidate the project requirement, preferred route, application evidence, and operator
            engagement into one traceable submission decision.
          </p>
        </div>
        <ClipboardCheck aria-hidden="true" />
      </div>
      {query.isLoading ? (
        <div className="compact-empty" role="status">
          Calculating qualification readiness…
        </div>
      ) : null}
      {query.error ? (
        <div className="compact-empty error-message" role="alert">
          Qualification could not be calculated. Refresh the project and try again.
        </div>
      ) : null}
      {result ? (
        <>
          <div className="qualification-summary">
            <div data-gate={result.gate}>
              <strong>{result.score}/100</strong>
              <span>{result.gate.replaceAll("_", " ")}</span>
            </div>
            <p>{result.boundary}</p>
          </div>
          <div className="qualification-checks">
            {result.checks.map((check) => (
              <article data-status={check.status} key={check.key}>
                {check.status === "ready" ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <ShieldAlert aria-hidden="true" />
                )}
                <div>
                  <header>
                    <h3>{check.label}</h3>
                    <b>
                      {check.points}/{check.maximum}
                    </b>
                  </header>
                  <p>{check.evidence}</p>
                  {check.nextAction ? <small>{check.nextAction}</small> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="qualification-actions">
            <div>
              <h3>Required Next Actions</h3>
              {result.nextActions.length ? (
                <ol>
                  {result.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              ) : (
                <p>All qualification controls are ready for a controlled submission package.</p>
              )}
            </div>
            <form onSubmit={captureGate}>
              <label>
                Qualification decision
                <select name="decision" defaultValue={result.gate} required>
                  <option value="ready_to_submit">Continue to submission</option>
                  <option value="request_evidence">Request more evidence</option>
                  <option value="hold">Hold qualification</option>
                  <option value="reject">Reject route</option>
                </select>
              </label>
              <label>
                Decision rationale
                <textarea
                  name="rationale"
                  minLength={10}
                  rows={3}
                  required
                  placeholder="Explain which evidence supports this gate…"
                />
              </label>
              <button className="primary-button" disabled={busy}>
                {busy ? "Capturing…" : "Capture Qualification Gate"}
              </button>
              <Link
                to="/submission-package/$id"
                params={{ id: site.id }}
                className="secondary-button"
              >
                Review Submission Package <ArrowRight aria-hidden="true" />
              </Link>
            </form>
          </div>
        </>
      ) : null}
    </section>
  );
}
