import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ClipboardList,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { CandidateSite } from "@/lib/assessment-model";
import {
  pilotOutcomeSummary,
  pilotReadiness,
  type PilotMeasurement,
} from "@/features/grid-connection/pilot-measurement";

export const Route = createFileRoute("/pilot-case/$id")({
  head: () => ({
    meta: [
      { title: "Pilot Outcome | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PilotCasePage,
});

type Engagement = {
  id: string;
  site_id: string;
  status: string;
  customer_organization: string;
  customer_decision_owner: string;
  project_sector: string;
  project_location: string;
  responsible_dso: string | null;
  responsible_tso: string | null;
  operator_contact_name: string | null;
  operator_contact_email: string | null;
  requested_import_mw: number;
  minimum_viable_import_mw: number | null;
  requested_export_mw: number | null;
  target_energization_date: string | null;
  flexibility_summary: string | null;
  pilot_objective: string;
  success_definition: string;
  engagement_authorized: boolean;
  anonymized_case_study_allowed: boolean;
  quotation_publication_allowed: boolean;
};
type Observation = PilotMeasurement & {
  id: string;
  observed_at: string;
  assessment_elapsed_days: number | null;
  sites_compared_count: number | null;
  operator_questions_count: number | null;
  material_risk_exposed: boolean | null;
  next_decision_improved: boolean | null;
  strategy_outcome: string | null;
  notes: string;
  confirmed_by_name: string | null;
};

const optionalNumber = (data: FormData, key: string) => {
  const value = String(data.get(key) ?? "").trim();
  return value === "" ? null : Number(value);
};
async function hashPayload(payload: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function PilotCasePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["pilot-case", id, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [site, engagement, observations, role] = await Promise.all([
        supabase.from("candidate_sites").select("*").eq("id", id).single(),
        supabase.from("pilot_engagements").select("*").eq("site_id", id).maybeSingle(),
        supabase
          .from("pilot_outcome_observations")
          .select("*")
          .eq("site_id", id)
          .order("observed_at"),
        supabase.rpc("get_assessment_role", { p_site_id: id }),
      ]);
      if (site.error) throw site.error;
      if (engagement.error) throw engagement.error;
      if (observations.error) throw observations.error;
      if (role.error) throw role.error;
      return {
        site: site.data as CandidateSite,
        engagement: engagement.data as Engagement | null,
        observations: observations.data as Observation[],
        role: String(role.data ?? "none"),
      };
    },
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["pilot-case", id] });
  if (query.isLoading)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <div className="loading-spinner" />
          <p>Loading pilot record…</p>
        </main>
      </AppShell>
    );
  if (!query.data || query.error)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <h1>Pilot unavailable</h1>
          <p>
            {query.error instanceof Error ? query.error.message : "This project is unavailable."}
          </p>
        </main>
      </AppShell>
    );
  const { site, engagement, observations, role } = query.data;
  const canEdit = [
    "owner",
    "customer_contributor",
    "technical_reviewer",
    "grid_expert",
    "workspace_admin",
  ].includes(role);
  const summary = pilotOutcomeSummary(observations);
  const readiness = engagement
    ? pilotReadiness({
        organization: engagement.customer_organization,
        decisionOwner: engagement.customer_decision_owner,
        location: engagement.project_location,
        requestedImportMw: Number(engagement.requested_import_mw),
        minimumViableImportMw:
          engagement.minimum_viable_import_mw == null
            ? null
            : Number(engagement.minimum_viable_import_mw),
        objective: engagement.pilot_objective,
        successDefinition: engagement.success_definition,
      })
    : [];

  async function saveEngagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      site_id: site.id,
      user_id: user!.id,
      status: data.get("status"),
      customer_organization: data.get("customer_organization"),
      customer_decision_owner: data.get("customer_decision_owner"),
      project_sector: data.get("project_sector"),
      project_location: data.get("project_location"),
      responsible_dso: data.get("responsible_dso") || null,
      responsible_tso: data.get("responsible_tso") || null,
      operator_contact_name: data.get("operator_contact_name") || null,
      operator_contact_email: data.get("operator_contact_email") || null,
      requested_import_mw: Number(data.get("requested_import_mw")),
      minimum_viable_import_mw: optionalNumber(data, "minimum_viable_import_mw"),
      requested_export_mw: optionalNumber(data, "requested_export_mw"),
      target_energization_date: data.get("target_energization_date") || null,
      flexibility_summary: data.get("flexibility_summary") || null,
      pilot_objective: data.get("pilot_objective"),
      success_definition: data.get("success_definition"),
      engagement_authorized: data.get("engagement_authorized") === "on",
      anonymized_case_study_allowed: data.get("anonymized_case_study_allowed") === "on",
      quotation_publication_allowed: data.get("quotation_publication_allowed") === "on",
    };
    setBusy(true);
    const result = engagement
      ? await supabase.from("pilot_engagements").update(payload).eq("id", engagement.id)
      : await supabase.from("pilot_engagements").insert(payload);
    setBusy(false);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Pilot definition saved");
      await refresh();
    }
  }

  async function addObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !engagement) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const measurement = {
      site_id: site.id,
      engagement_id: engagement.id,
      user_id: user!.id,
      stage: data.get("stage"),
      assessment_elapsed_days: optionalNumber(data, "assessment_elapsed_days"),
      preparation_hours: optionalNumber(data, "preparation_hours"),
      evidence_gaps_count: optionalNumber(data, "evidence_gaps_count"),
      sites_compared_count: optionalNumber(data, "sites_compared_count"),
      operator_questions_count: optionalNumber(data, "operator_questions_count"),
      clarification_rounds_count: optionalNumber(data, "clarification_rounds_count"),
      rework_hours_avoided: optionalNumber(data, "rework_hours_avoided"),
      customer_hours_saved: optionalNumber(data, "customer_hours_saved"),
      operator_validated_mw: optionalNumber(data, "operator_validated_mw"),
      strategy_outcome: data.get("strategy_outcome") || null,
      material_risk_exposed: data.get("material_risk_exposed") === "on",
      next_decision_improved: data.get("next_decision_improved") === "on",
      operator_feedback_received: data.get("operator_feedback_received") === "on",
      notes: data.get("notes"),
      customer_confirmed: data.get("customer_confirmed") === "on",
      confirmed_by_name: data.get("confirmed_by_name") || null,
    };
    setBusy(true);
    const { error } = await supabase
      .from("pilot_outcome_observations")
      .insert({ ...measurement, content_hash: await hashPayload(measurement) });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      form.reset();
      toast.success("Append-only pilot snapshot recorded");
      await refresh();
    }
  }

  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page pilot-case-page">
        <Link to="/assessments/$id" params={{ id }} className="back-link">
          <ArrowLeft /> Project workspace
        </Link>
        <header className="assessment-title">
          <div>
            <p className="context-label">Design-partner pilot</p>
            <h1>{site.name}</h1>
            <p>
              Measure whether GridPulse reduces preparation work, exposes material risk or improves
              the next connection decision.
            </p>
          </div>
          <span className="status">{engagement?.status ?? "Not onboarded"}</span>
        </header>
        <div className="truth-banner">
          <ShieldCheck />
          <div>
            <b>Commercial proof must remain evidence-backed</b>
            <p>
              Customer confirmation supports workflow claims. Capacity or timing claims additionally
              require written operator evidence.
            </p>
          </div>
        </div>
        <section className="pilot-kpi-grid">
          <article>
            <span>Preparation reduction</span>
            <strong>
              {summary.preparationHoursReduced == null
                ? "—"
                : `${summary.preparationHoursReduced} h`}
            </strong>
          </article>
          <article>
            <span>Clarification reduction</span>
            <strong>
              {summary.clarificationRoundsReduced == null
                ? "—"
                : summary.clarificationRoundsReduced}
            </strong>
          </article>
          <article>
            <span>Customer-confirmed final</span>
            <strong>{summary.publishable ? "Yes" : "No"}</strong>
          </article>
          <article>
            <span>Operator-validated MW</span>
            <strong>
              {summary.operatorValidated
                ? `${summary.final?.operator_validated_mw} MW`
                : "Not evidenced"}
            </strong>
          </article>
        </section>
        {canEdit ? (
          <form
            className="workspace-card activation-form pilot-engagement-form"
            onSubmit={saveEngagement}
          >
            <div className="panel-heading">
              <div>
                <h2>1. Define the real pilot</h2>
                <p>
                  One genuine German connection case, one accountable owner, and one measurable
                  success definition.
                </p>
              </div>
              <ClipboardList />
            </div>
            <div className="form-grid two-columns">
              <label>
                Customer organization
                <input
                  name="customer_organization"
                  defaultValue={engagement?.customer_organization}
                  required
                />
              </label>
              <label>
                Decision owner
                <input
                  name="customer_decision_owner"
                  defaultValue={engagement?.customer_decision_owner}
                  required
                />
              </label>
              <label>
                Sector
                <select
                  name="project_sector"
                  defaultValue={engagement?.project_sector ?? "data_centre"}
                >
                  <option value="data_centre">Data centre</option>
                  <option value="bess">BESS</option>
                  <option value="industrial_load">Industrial load</option>
                  <option value="electrolyser">Electrolyser</option>
                  <option value="generation">Generation</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={engagement?.status ?? "onboarding"}>
                  <option value="onboarding">Onboarding</option>
                  <option value="baseline">Baseline</option>
                  <option value="active">Active</option>
                  <option value="operator_review">Operator review</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
            </div>
            <label>
              Project location
              <input name="project_location" defaultValue={engagement?.project_location} required />
            </label>
            <div className="form-grid three-columns">
              <label>
                Requested import MW
                <input
                  name="requested_import_mw"
                  type="number"
                  step="0.1"
                  min="0"
                  defaultValue={engagement?.requested_import_mw ?? site.requested_import_mw}
                  required
                />
              </label>
              <label>
                Minimum viable MW
                <input
                  name="minimum_viable_import_mw"
                  type="number"
                  step="0.1"
                  min="0"
                  defaultValue={engagement?.minimum_viable_import_mw ?? ""}
                  required
                />
              </label>
              <label>
                Requested export MW
                <input
                  name="requested_export_mw"
                  type="number"
                  step="0.1"
                  min="0"
                  defaultValue={engagement?.requested_export_mw ?? site.requested_export_mw}
                />
              </label>
            </div>
            <div className="form-grid two-columns">
              <label>
                Responsible DSO
                <input name="responsible_dso" defaultValue={engagement?.responsible_dso ?? ""} />
              </label>
              <label>
                Responsible TSO
                <input name="responsible_tso" defaultValue={engagement?.responsible_tso ?? ""} />
              </label>
              <label>
                Operator contact
                <input
                  name="operator_contact_name"
                  defaultValue={engagement?.operator_contact_name ?? ""}
                />
              </label>
              <label>
                Operator email
                <input
                  name="operator_contact_email"
                  type="email"
                  defaultValue={engagement?.operator_contact_email ?? ""}
                />
              </label>
            </div>
            <label>
              Target energization date
              <input
                name="target_energization_date"
                type="date"
                defaultValue={engagement?.target_energization_date ?? ""}
              />
            </label>
            <label>
              Flexibility constraints
              <textarea
                name="flexibility_summary"
                defaultValue={engagement?.flexibility_summary ?? ""}
              />
            </label>
            <label>
              Pilot objective
              <textarea
                name="pilot_objective"
                defaultValue={engagement?.pilot_objective}
                required
              />
            </label>
            <label>
              Measurable success definition
              <textarea
                name="success_definition"
                defaultValue={engagement?.success_definition}
                required
              />
            </label>
            <div className="pilot-consent-grid">
              <label>
                <input
                  name="engagement_authorized"
                  type="checkbox"
                  defaultChecked={engagement?.engagement_authorized}
                />{" "}
                Customer authorizes operator engagement
              </label>
              <label>
                <input
                  name="anonymized_case_study_allowed"
                  type="checkbox"
                  defaultChecked={engagement?.anonymized_case_study_allowed}
                />{" "}
                Anonymized case study permitted
              </label>
              <label>
                <input
                  name="quotation_publication_allowed"
                  type="checkbox"
                  defaultChecked={engagement?.quotation_publication_allowed}
                />{" "}
                Customer quotation permitted
              </label>
            </div>
            <button className="primary-button" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Check />} Save pilot definition
            </button>
          </form>
        ) : null}
        {engagement ? (
          <section className="workspace-card">
            <div className="panel-heading">
              <div>
                <h2>Pilot readiness</h2>
                <p>
                  {readiness.filter((item) => item.complete).length} of {readiness.length}{" "}
                  commercial controls complete
                </p>
              </div>
              <ShieldCheck />
            </div>
            <div className="pilot-readiness-list">
              {readiness.map((item) => (
                <div key={item.key} className={item.complete ? "complete" : "open"}>
                  <Check /> {item.label}
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {canEdit && engagement ? (
          <form
            className="workspace-card activation-form pilot-observation-form"
            onSubmit={addObservation}
          >
            <div className="panel-heading">
              <div>
                <h2>2. Record a measurement snapshot</h2>
                <p>Baseline, interim and final observations are append-only.</p>
              </div>
              <BarChart3 />
            </div>
            <div className="form-grid three-columns">
              <label>
                Stage
                <select name="stage">
                  <option value="baseline">Before GridPulse</option>
                  <option value="interim">During pilot</option>
                  <option value="final">After GridPulse</option>
                </select>
              </label>
              <label>
                Assessment days
                <input name="assessment_elapsed_days" type="number" min="0" step="0.1" />
              </label>
              <label>
                Preparation hours
                <input name="preparation_hours" type="number" min="0" step="0.1" />
              </label>
              <label>
                Evidence gaps found
                <input name="evidence_gaps_count" type="number" min="0" />
              </label>
              <label>
                Sites compared
                <input name="sites_compared_count" type="number" min="0" />
              </label>
              <label>
                Operator questions prepared
                <input name="operator_questions_count" type="number" min="0" />
              </label>
              <label>
                Clarification rounds
                <input name="clarification_rounds_count" type="number" min="0" />
              </label>
              <label>
                Rework hours avoided
                <input name="rework_hours_avoided" type="number" min="0" step="0.1" />
              </label>
              <label>
                Customer hours saved
                <input name="customer_hours_saved" type="number" min="0" step="0.1" />
              </label>
              <label>
                Operator-validated MW
                <input name="operator_validated_mw" type="number" min="0" step="0.1" />
              </label>
              <label>
                Strategy outcome
                <select name="strategy_outcome">
                  <option value="pending_operator">Pending operator</option>
                  <option value="unchanged">Unchanged</option>
                  <option value="strengthened">Strengthened</option>
                  <option value="changed">Changed</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
            </div>
            <div className="pilot-consent-grid">
              <label>
                <input name="material_risk_exposed" type="checkbox" /> Material risk exposed
              </label>
              <label>
                <input name="next_decision_improved" type="checkbox" /> Next decision improved
              </label>
              <label>
                <input name="operator_feedback_received" type="checkbox" /> Written operator
                feedback received
              </label>
              <label>
                <input name="customer_confirmed" type="checkbox" /> Customer confirms this
                observation
              </label>
            </div>
            <label>
              Confirmed by
              <input name="confirmed_by_name" placeholder="Customer decision owner" />
            </label>
            <label>
              Evidence and notes
              <textarea name="notes" required />
            </label>
            <button className="primary-button" disabled={busy}>
              <BarChart3 /> Record immutable snapshot
            </button>
          </form>
        ) : null}
        <section className="workspace-card">
          <div className="panel-heading">
            <div>
              <h2>Measurement history</h2>
              <p>Source-aware record for the final case study.</p>
            </div>
            <BarChart3 />
          </div>
          {observations.length ? (
            <div className="pilot-observation-list">
              {observations.map((row) => (
                <article key={row.id}>
                  <span className="status">{row.stage}</span>
                  <div>
                    <b>{new Date(row.observed_at).toLocaleString("de-DE")}</b>
                    <p>{row.notes}</p>
                    <small>
                      {row.customer_confirmed
                        ? `Customer-confirmed by ${row.confirmed_by_name || "named owner"}`
                        : "Internal observation—not yet customer-confirmed"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="compact-empty">Record the baseline before beginning delivery.</div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
