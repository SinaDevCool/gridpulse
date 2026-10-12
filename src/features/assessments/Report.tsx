import { useState } from "react";

import { AlertTriangle,FileText,LoaderCircle,Save } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import {
activationDecision,
label,
readiness,
type AssessmentDocument,
type AssessmentMilestone,
type CandidateSite,
type DecisionMemo,
type Evidence,
type FcaEnvelope,
type IntervalProfile,
type OperatorRequirement,
type Scenario,
} from "@/lib/assessment-model";

export function Report({
  site,
  evidence,
  scenarios,
  profiles,
  requirements,
  documents,
  milestones,
  envelopes,
  memos,
  refresh,
}: {
  site: CandidateSite;
  evidence: Evidence[];
  scenarios: Scenario[];
  profiles: IntervalProfile[];
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  milestones: AssessmentMilestone[];
  envelopes: FcaEnvelope[];
  memos: DecisionMemo[];
  refresh: () => Promise<void>;
}) {
  const state = readiness(evidence);
  const decision = activationDecision({ site, requirements, documents, profiles, envelopes });
  const [saving, setSaving] = useState(false);
  async function saveSnapshot() {
    setSaving(true);
    const { error } = await supabase.from("decision_memos").insert({
      site_id: site.id,
      user_id: site.user_id,
      version: 0,
      readiness_score: decision.score,
      workflow_status: site.decision_status,
      recommended_next_action: decision.nextAction,
      blockers: decision.blockers,
      snapshot: {
        project: {
          name: site.name,
          projectType: site.project_type,
          requestedImportMw: site.requested_import_mw,
          requestedExportMw: site.requested_export_mw,
          targetVoltageKv: site.target_voltage_kv,
        },
        counts: {
          evidence: evidence.length,
          requirements: requirements.length,
          documents: documents.length,
          scenarios: scenarios.length,
          milestones: milestones.length,
        },
        generatedAt: new Date().toISOString(),
        limitation:
          "Not a grid connection offer, network study, capacity reservation, or revenue forecast.",
      },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Decision memo snapshot saved");
    await refresh();
  }
  return (
    <article className="print-report">
      <header>
        <div>
          <p className="context-label">GridPulse pre-feasibility report</p>
          <h1>{site.name}</h1>
          <p>Generated {new Date().toLocaleDateString()} · Preliminary decision support</p>
        </div>
        <div className="report-actions no-print">
          <span>
            {memos.length ? `Latest saved version: ${memos[0].version}` : "No saved version"}
          </span>
          <button onClick={() => void saveSnapshot()} disabled={saving}>
            {saving ? <LoaderCircle className="spin" /> : <Save />} Save snapshot
          </button>
          <button className="primary-button" onClick={() => window.print()}>
            <FileText /> Print / save PDF
          </button>
        </div>
      </header>
      {!state.ready ? (
        <div className="report-blocker">
          <AlertTriangle />
          <div>
            <b>Report generation is locked</b>
            <p>
              Add a collected official source, a collected customer input, and validated operator
              evidence.
            </p>
          </div>
        </div>
      ) : null}
      <section>
        <h2>Executive decision</h2>
        <dl className="report-details">
          <dt>Decision-package readiness</dt>
          <dd>{decision.score}/100</dd>
          <dt>Recommended next action</dt>
          <dd>{decision.nextAction}</dd>
          <dt>Workflow status</dt>
          <dd>{label(site.decision_status)}</dd>
          <dt>Target energization</dt>
          <dd>{site.target_energization_date ?? "Not scheduled"}</dd>
        </dl>
        {decision.blockers.map((blocker) => (
          <div className="report-row" key={blocker}>
            <b>Open gate</b>
            <span>{blocker}</span>
          </div>
        ))}
      </section>
      <section>
        <h2>Project requirement</h2>
        <dl className="report-details">
          <dt>Project type</dt>
          <dd>{label(site.project_type)}</dd>
          <dt>Location</dt>
          <dd>
            {site.latitude}, {site.longitude}
          </dd>
          <dt>Requested import</dt>
          <dd>{site.requested_import_mw} MW</dd>
          <dt>Requested export</dt>
          <dd>{site.requested_export_mw} MW</dd>
          <dt>Target voltage</dt>
          <dd>{site.target_voltage_kv ?? "Not supplied"} kV</dd>
          <dt>Network operator</dt>
          <dd>
            {site.responsible_operator_name ?? site.likely_network_operator ?? "Not confirmed"} (
            {label(site.responsibility_source ?? site.operator_status)})
          </dd>
        </dl>
      </section>
      <section>
        <h2>Operator application readiness</h2>
        {requirements.map((item) => (
          <div className="report-row" key={item.id}>
            <b>{item.label}</b>
            <span>
              {label(item.status)} ·{" "}
              {documents.find((document) => document.id === item.document_id)?.file_name ??
                "No linked document"}
            </span>
          </div>
        ))}
      </section>
      <section>
        <h2>Evidence ledger</h2>
        <p>
          {evidence.length} items recorded. Each retains its classification and validation status.
        </p>
        {evidence.map((item) => (
          <div className="report-row" key={item.id}>
            <b>{item.title}</b>
            <span>
              {label(item.classification)} · {label(item.validation_status)}
            </span>
          </div>
        ))}
      </section>
      <section>
        <h2>Operating profile</h2>
        {profiles.length === 0 ? (
          <p>No interval profile supplied.</p>
        ) : (
          profiles.map((profile) => (
            <div className="report-row" key={profile.id}>
              <b>{profile.name}</b>
              <span>
                {profile.interval_count.toLocaleString()} × {profile.interval_minutes}-minute
                intervals · peak {profile.peak_import_mw} MW import / {profile.peak_export_mw} MW
                export
              </span>
            </div>
          ))
        )}
      </section>
      <section>
        <h2>Connection scenarios</h2>
        {scenarios.length === 0 ? (
          <p>No restriction scenarios supplied.</p>
        ) : (
          scenarios.map((s) => (
            <div className="report-row" key={s.id}>
              <b>{s.name}</b>
              <span>
                {label(s.connection_mode)} · Import {s.max_import_mw ?? "unknown"} MW · Export{" "}
                {s.max_export_mw ?? "unknown"} MW
                {s.analysis
                  ? ` · ${s.analysis.constrainedImportMwh + s.analysis.constrainedExportMwh} MWh constrained · €${s.analysis.estimatedGrossImpactEur.toLocaleString()} indicative impact`
                  : ""}
              </span>
            </div>
          ))
        )}
      </section>
      <section>
        <h2>Delivery milestones</h2>
        {milestones.length === 0 ? (
          <p>No deadlines recorded.</p>
        ) : (
          milestones.map((item) => (
            <div className="report-row" key={item.id}>
              <b>{item.title}</b>
              <span>
                {label(item.status)} · due {new Date(item.due_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </section>
      <footer>
        <b>Limitations</b>
        <p>
          This report is not a grid connection offer, network study, capacity reservation, or
          revenue forecast. Operator validation remains controlling.
        </p>
      </footer>
    </article>
  );
}
