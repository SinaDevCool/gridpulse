import { type FormEvent } from "react";

import {
AlertTriangle,
ArrowRight,
CalendarClock,
ExternalLink,
FileText,
LoaderCircle,
Save,
Zap,
} from "lucide-react";

import { toast } from "sonner";

import { buildCustomerPathways } from "@/features/grid-connection/customer-journey";

import { supabase } from "@/integrations/supabase/client";

import {
activationDecision,
label,
type AssessmentDocument,
type CandidateSite,
type FcaEnvelope,
type IntervalProfile,
type OperatorRequirement,
} from "@/lib/assessment-model";

import { screenGermanOperator } from "@/lib/german-grid-screening";

import { type Tab } from "./presentation";

export function Overview({
  site,
  requirements,
  documents,
  profiles,
  envelopes,
  busy,
  setBusy,
  openTab,
  refresh,
}: {
  site: CandidateSite;
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  profiles: IntervalProfile[];
  envelopes: FcaEnvelope[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  openTab: (tab: Tab) => void;
  refresh: () => Promise<void>;
}) {
  const screening = screenGermanOperator(site.latitude, site.longitude);
  const decision = activationDecision({ site, requirements, documents, profiles, envelopes });
  const pathways = buildCustomerPathways({
    requestedImportMw: site.requested_import_mw,
    minimumViableImportMw: site.minimum_viable_import_mw,
    hasIntervalProfile: profiles.length > 0,
  });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const f = new FormData(event.currentTarget);
    const { error } = await supabase
      .from("candidate_sites")
      .update({
        name: String(f.get("name")),
        requested_import_mw: Number(f.get("importMw")),
        requested_export_mw: Number(f.get("exportMw")),
        target_voltage_kv: Number(f.get("voltageKv")) || null,
        likely_network_operator: String(f.get("operator") || "") || null,
        operator_status: String(f.get("operatorStatus")),
        operator_confirmation_status: String(f.get("operatorConfirmationStatus")),
        target_energization_date: String(f.get("targetEnergizationDate") || "") || null,
        decision_status: String(f.get("decisionStatus")),
        decision_notes: String(f.get("decisionNotes") || "") || null,
      })
      .eq("id", site.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Project details saved");
      await refresh();
    }
  }
  return (
    <div className="activation-stack">
      <section className="customer-result" aria-labelledby="screening-result-title">
        <div className="result-heading">
          <div>
            <span className="context-label">Initial connection screening</span>
            <h2 id="screening-result-title">Your credible route to operator engagement</h2>
            <p>
              GridPulse has organised the declared requirement and routed the project to a likely
              transmission-area context. Deliverable capacity remains unconfirmed.
            </p>
          </div>
          <span className="result-status">
            <AlertTriangle /> Operator evidence required
          </span>
        </div>
        <div className="result-facts">
          <article>
            <small>Declared requirement</small>
            <b>{site.requested_import_mw} MW import</b>
            <span>
              {site.minimum_viable_import_mw
                ? `${site.minimum_viable_import_mw} MW minimum viable stage`
                : "Minimum viable stage not declared"}
            </span>
          </article>
          <article>
            <small>Likely responsibility</small>
            <b>{site.likely_network_operator ?? screening.transmissionOperator}</b>
            <span>Screening result—not operator confirmation</span>
          </article>
          <article>
            <small>Project maturity</small>
            <b>{label(site.land_status)}</b>
            <span>Planning: {label(site.planning_status)}</span>
          </article>
        </div>
        <div className="pathway-heading">
          <div>
            <span className="context-label">Connection pathways to test</span>
            <h3>Three routes—not three promises</h3>
          </div>
          <p>The responsible network operator determines technical feasibility and conditions.</p>
        </div>
        <div className="pathway-grid">
          {pathways.map((pathway, index) => {
            const Icon =
              pathway.key === "firm" ? Zap : pathway.key === "staged" ? FileText : CalendarClock;
            return (
              <article className={pathway.candidate ? "candidate" : ""} key={pathway.key}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon />
                <h3>{pathway.title}</h3>
                <p>{pathway.description}</p>
                <small>{pathway.status}</small>
              </article>
            );
          })}
        </div>
        <div className="result-next-action">
          <div>
            <small>Recommended next action</small>
            <b>{decision.nextAction}</b>
          </div>
          <div>
            <button className="secondary-button" onClick={() => openTab("evidence")}>
              Review evidence gaps
            </button>
            <button
              className="primary-button"
              onClick={() => openTab(site.minimum_viable_import_mw ? "strategy" : "overview")}
            >
              {site.minimum_viable_import_mw ? "Compare pathways" : "Complete project inputs"}
              <ArrowRight />
            </button>
          </div>
        </div>
      </section>
      <section className="workspace-card decision-summary">
        <div className="decision-score">
          <span>Decision-package readiness</span>
          <b>{decision.score}</b>
          <small>/ 100 evidence-weighted</small>
        </div>
        <div>
          <span className="context-label">Recommended next action</span>
          <h2>{decision.nextAction}</h2>
          <p>
            This score measures decision readiness, not grid headroom. Capacity remains unknown
            until the responsible operator provides evidence.
          </p>
        </div>
        <div className="decision-blockers">
          <span>{decision.blockers.length} open gates</span>
          {decision.blockers.slice(0, 3).map((blocker) => (
            <small key={blocker}>
              <AlertTriangle /> {blocker}
            </small>
          ))}
        </div>
      </section>
      <div className="workspace-columns">
        <form className="product-form" onSubmit={save}>
          <div className="form-section">
            <h2>Project and connection requirement</h2>
            <p>Customer inputs remain distinct from operator-confirmed information.</p>
            <label>
              Project name
              <input name="name" defaultValue={site.name} required />
            </label>
            <div className="form-grid">
              <label>
                Requested import (MW)
                <input
                  name="importMw"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={site.requested_import_mw}
                />
              </label>
              <label>
                Requested export (MW)
                <input
                  name="exportMw"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={site.requested_export_mw}
                />
              </label>
            </div>
            <label>
              Target voltage (kV)
              <input
                name="voltageKv"
                type="number"
                min="0"
                step="0.001"
                defaultValue={site.target_voltage_kv ?? ""}
              />
            </label>
          </div>
          <div className="form-section">
            <h2>Network operator screening</h2>
            <label>
              Likely network operator
              <input
                name="operator"
                defaultValue={site.likely_network_operator ?? screening.transmissionOperator}
                placeholder="Enter screening result"
              />
              <small className="field-help">
                Suggested transmission-area context: {screening.transmissionOperator}. Screening
                only; confirm the responsible DSO and connection point.
              </small>
            </label>
            <label>
              Confirmation status
              <select
                name="operatorConfirmationStatus"
                defaultValue={site.operator_confirmation_status}
              >
                <option value="screening_only">Screening only</option>
                <option value="customer_confirmed">Customer confirmed</option>
                <option value="operator_confirmed">Operator confirmed</option>
              </select>
            </label>
            <input name="operatorStatus" type="hidden" value={site.operator_status} />
          </div>
          <div className="form-section">
            <h2>Connection-strategy decision</h2>
            <div className="form-grid two-columns">
              <label>
                Workflow decision
                <select name="decisionStatus" defaultValue={site.decision_status}>
                  <option value="collect_evidence">Collect evidence</option>
                  <option value="prepare_application">Prepare application</option>
                  <option value="submit_application">Submit application</option>
                  <option value="operator_review">Operator review</option>
                  <option value="envelope_agreed">Envelope agreed</option>
                  <option value="hold">Hold</option>
                </select>
              </label>
              <label>
                Target energization
                <input
                  name="targetEnergizationDate"
                  type="date"
                  defaultValue={site.target_energization_date ?? ""}
                />
              </label>
            </div>
            <label>
              Decision notes
              <textarea name="decisionNotes" rows={3} defaultValue={site.decision_notes ?? ""} />
            </label>
            <label>
              Legacy operator stage
              <select name="operatorStatusDisplay" defaultValue={site.operator_status} disabled>
                <option value="screening">Screening only</option>
                <option value="customer_confirmed">Customer confirmed</option>
                <option value="operator_confirmed">Operator confirmed</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <span>Updated {new Date(site.updated_at).toLocaleDateString()}</span>
            <button className="primary-button" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Save />}Save changes
            </button>
          </div>
        </form>
        <aside className="guidance-card">
          <h2>Declared project envelope</h2>
          <dl className="detail-list">
            <dt>Country</dt>
            <dd>{site.country_code}</dd>
            <dt>Coordinates</dt>
            <dd>
              {site.latitude}, {site.longitude}
            </dd>
            <dt>Project type</dt>
            <dd>{label(site.project_type)}</dd>
            <dt>Operator status</dt>
            <dd>{label(site.operator_status)}</dd>
            <dt>Regional context</dt>
            <dd>{screening.regionalContext}</dd>
          </dl>
          <a href={screening.sourceUrl} target="_blank" rel="noreferrer">
            Review German transmission planning source <ExternalLink />
          </a>
        </aside>
      </div>
    </div>
  );
}
