import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Gavel, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite } from "@/lib/assessment-model";
import { assessCommercialDecision } from "./commercial-decision";
import type { DecisionMatrixRow } from "./decision-matrix";

type Props = {
  site: CandidateSite;
  preferredOption: DecisionMatrixRow | null;
  estimatedConnectionCostEur: number | null;
  indicatedConnectionDate: string | null;
};

const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function CommercialDecisionGate({
  site,
  preferredOption,
  estimatedConnectionCostEur,
  indicatedConnectionDate,
}: Props) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const decision = assessCommercialDecision({
    requestedImportMw: site.requested_import_mw,
    minimumViableImportMw: site.minimum_viable_import_mw ?? site.requested_import_mw,
    preferredOption,
    estimatedConnectionCostEur,
    indicatedConnectionDate,
    targetConnectionDate: site.target_energization_date,
  });

  async function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const result = await supabase.rpc("capture_project_decision_snapshot", {
      p_site_id: site.id,
      p_snapshot_type: "site_selection",
      p_decision_label: data.get("decision"),
      p_decision_rationale: data.get("rationale"),
    });
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    form.reset();
    toast.success("Commercial decision gate captured");
    await client.invalidateQueries({ queryKey: ["decision-snapshots", site.id] });
  }

  return (
    <article className="strategy-card commercial-decision-gate">
      <div className="panel-heading">
        <div>
          <p className="context-label">Phase 4 · commercial decision gate</p>
          <h3>Investment Decision Boundary</h3>
        </div>
        <Gavel aria-hidden="true" />
      </div>
      <div className="commercial-gate-summary" data-gate={decision.gate}>
        <strong>{decision.score}/100</strong>
        <span>{decision.gate}</span>
      </div>
      <dl>
        <div>
          <dt>Initial import</dt>
          <dd>{decision.initialImportMw == null ? "Unknown" : `${decision.initialImportMw} MW`}</dd>
        </div>
        <div>
          <dt>Demand coverage</dt>
          <dd>
            {decision.demandCoveragePercent == null
              ? "Unknown"
              : `${decision.demandCoveragePercent}%`}
          </dd>
        </div>
        <div>
          <dt>Annual operating exposure</dt>
          <dd>
            {decision.annualExposureEur == null
              ? "Not quantified"
              : money.format(decision.annualExposureEur)}
          </dd>
        </div>
        <div>
          <dt>Connection capital</dt>
          <dd>
            {decision.connectionCostEur == null
              ? "Not operator-indicated"
              : money.format(decision.connectionCostEur)}
          </dd>
        </div>
        <div>
          <dt>Schedule evidence</dt>
          <dd>{decision.scheduleStatus.replaceAll("_", " ")}</dd>
        </div>
      </dl>
      <div className="commercial-risks">
        <h4>
          <ShieldAlert aria-hidden="true" /> Decision Risks
        </h4>
        {decision.risks.length ? (
          decision.risks.map((risk) => (
            <div data-severity={risk.severity} key={risk.key}>
              <b>{risk.label}</b>
              <small>{risk.mitigation}</small>
            </div>
          ))
        ) : (
          <p>No unresolved commercial gates are recorded in the current evidence set.</p>
        )}
      </div>
      <p className="commercial-boundary">{decision.boundary}</p>
      <form onSubmit={capture}>
        <label>
          Investment decision
          <select name="decision" defaultValue={decision.gate} required>
            <option value="proceed">Proceed</option>
            <option value="conditional">Proceed conditionally</option>
            <option value="hold">Hold</option>
            <option value="reject">Reject</option>
          </select>
        </label>
        <label>
          Decision rationale
          <textarea
            name="rationale"
            rows={3}
            minLength={10}
            required
            placeholder="Explain the evidence, exposure, and conditions behind this decision…"
          />
        </label>
        <button className="primary-button" disabled={busy}>
          <CircleDollarSign aria-hidden="true" />
          {busy ? "Capturing…" : "Capture Commercial Gate"}
        </button>
      </form>
    </article>
  );
}
