import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileCheck2,
  Info,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { screenGermanOperator } from "@/lib/german-grid-screening";

export const Route = createFileRoute("/assessments/new")({
  validateSearch: z.object({
    pilotRequestId: z.string().uuid().optional(),
    name: z.string().max(160).optional(),
    projectType: z.enum(["bess", "large_load", "co_location"]).optional(),
    postcode: z.coerce.string().max(5).optional(),
    municipality: z.string().max(160).optional(),
    federalState: z.string().max(80).optional(),
    importMw: z.coerce.number().min(0).optional(),
    minimumViableImportMw: z.coerce.number().min(0).optional(),
    exportMw: z.coerce.number().min(0).optional(),
    batteryPowerMw: z.coerce.number().min(0).optional(),
    batteryEnergyMwh: z.coerce.number().min(0).optional(),
    targetDate: z.string().optional(),
    landStatus: z.enum(["unknown", "identified", "optioned", "controlled"]).optional(),
    planningStatus: z
      .enum(["unknown", "not_started", "pre_application", "submitted", "approved"])
      .optional(),
    challenge: z.string().max(3000).optional(),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: NewAssessment,
});

const steps = [
  { label: "Define the project", hint: "Asset and objective", icon: Building2 },
  { label: "Confirm the site", hint: "Location and maturity", icon: MapPin },
  { label: "Declare the requirement", hint: "Requested power and flexibility", icon: Zap },
  { label: "Review the evidence", hint: "Confirm declarations", icon: FileCheck2 },
];

const projectTypes = {
  "Data centre / AI campus": { projectType: "large_load", projectKind: "ai_hpc_data_centre" },
  "Other large electrical load": { projectType: "large_load", projectKind: "industrial_load" },
  "Battery energy storage": { projectType: "bess", projectKind: "battery_storage" },
  "Co-located load + storage": { projectType: "co_location", projectKind: "hybrid_load_storage" },
} as const;
type ProjectTypeLabel = keyof typeof projectTypes;

function NewAssessment() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const initialType =
    (Object.entries(projectTypes).find(
      ([, value]) => value.projectType === search.projectType,
    )?.[0] as ProjectTypeLabel | undefined) ?? "Data centre / AI campus";
  const [type, setType] = useState<ProjectTypeLabel>(initialType);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Record<string, string>>({});

  function continueTo(nextStep: number) {
    const current = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const fields = Array.from(
      current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select, textarea") ??
        [],
    );
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (nextStep === 3 && formRef.current) {
      setReview(
        Object.fromEntries(
          Array.from(new FormData(formRef.current).entries()).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
      );
    }
    setError("");
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      continueTo(step + 1);
      return;
    }
    if (!user) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const selectedType = projectTypes[type];
    const payload = {
      user_id: user.id,
      name: String(form.get("name") ?? "").trim(),
      project_type: selectedType.projectType,
      project_kind: selectedType.projectKind,
      latitude: Number(form.get("latitude")),
      longitude: Number(form.get("longitude")),
      requested_import_mw: Number(form.get("importMw") || 0),
      minimum_viable_import_mw: Number(form.get("minimumViableImportMw")) || null,
      requested_export_mw: Number(form.get("exportMw") || 0),
      bess_power_mw: Number(form.get("batteryPowerMw")) || null,
      bess_energy_mwh: Number(form.get("batteryEnergyMwh")) || null,
      target_voltage_kv: Number(form.get("voltageKv")) || null,
      target_energization_date: String(form.get("targetDate") || "") || null,
      land_status: String(form.get("landStatus") || "unknown"),
      planning_status: String(form.get("planningStatus") || "unknown"),
      postcode: String(form.get("postcode") || "") || null,
      municipality: String(form.get("municipality") || "") || null,
      federal_state: String(form.get("federalState") || "") || null,
      redundancy_requirement: String(form.get("redundancyRequirement") || "") || null,
      connection_challenge: String(form.get("challenge") || "") || null,
      intake_source: search.pilotRequestId ? "pilot_request" : "workspace",
      pilot_request_id: search.pilotRequestId ?? null,
    };
    const screening = screenGermanOperator(payload.latitude, payload.longitude);
    const { data: created, error: insertError } = await supabase
      .from("candidate_sites")
      .insert(payload)
      .select("id")
      .single();
    if (insertError) {
      setBusy(false);
      setError(insertError.message);
      return;
    }
    const { error: profileError } = await supabase.rpc("apply_operator_profile", {
      p_site_id: created.id,
      p_profile_key: screening.profileKey,
    });
    if (profileError) toast.warning("Project created, but operator routing needs review");
    if (search.pilotRequestId) {
      const { error: requestError } = await supabase
        .from("pilot_requests")
        .update({ status: "converted" })
        .eq("id", search.pilotRequestId);
      if (requestError) toast.warning("Project created; update the pilot request manually");
    }
    toast.success("Private connection case created");
    await navigate({ to: "/assessments/$id", params: { id: created.id } });
  }

  const showBattery = type === "Battery energy storage" || type === "Co-located load + storage";
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page intake-page">
        <PageHeading
          eyebrow="Private Connection Assessment"
          title="Start a private connection case"
          description="Create the project record used to discover the route, design connection hypotheses, and prepare the operator-engagement strategy."
        />
        <div className="intake-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                className={index === step ? "active" : index < step ? "complete" : ""}
                onClick={() => index < step && continueTo(index)}
                disabled={index > step}
                key={item.label}
              >
                <span>{index < step ? <Check /> : <Icon />}</span>
                <b>{item.label}</b>
                <small>{item.hint}</small>
              </button>
            );
          })}
        </div>
        <div className="intake-layout">
          <form
            ref={formRef}
            className="product-form intake-form"
            autoComplete="off"
            onSubmit={createProject}
          >
            <fieldset data-step="0" hidden={step !== 0}>
              <legend>What needs a grid connection?</legend>
              <p>Use the commercial project name and choose the closest asset type.</p>
              <label>
                Project name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="e.g. Brandenburg AI Campus"
                  defaultValue={search.name}
                />
              </label>
              <div className="choice-grid">
                {Object.keys(projectTypes).map((option) => (
                  <label
                    className={type === option ? "choice-card selected" : "choice-card"}
                    key={option}
                  >
                    <input
                      type="radio"
                      name="projectTypeChoice"
                      checked={type === option}
                      onChange={() => setType(option as ProjectTypeLabel)}
                    />
                    <span>
                      <Building2 />
                      <b>{option}</b>
                    </span>
                  </label>
                ))}
              </div>
              <label>
                Current connection challenge <span className="optional">Optional</span>
                <textarea
                  name="challenge"
                  rows={4}
                  defaultValue={search.challenge}
                  placeholder="For example: requested capacity exceeds the operator's initial indication, or commissioning depends on staged capacity."
                />
              </label>
            </fieldset>

            <fieldset data-step="1" hidden={step !== 1}>
              <legend>Where is the project and how mature is it?</legend>
              <p>
                Coordinates support a transmission-area screening only. The responsible DSO and
                connection point still require confirmation.
              </p>
              <div className="form-grid">
                <label>
                  Postcode
                  <input
                    name="postcode"
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    defaultValue={search.postcode}
                    required
                  />
                </label>
                <label>
                  Municipality
                  <input name="municipality" defaultValue={search.municipality} required />
                </label>
              </div>
              <label>
                Federal state
                <input name="federalState" defaultValue={search.federalState} required />
              </label>
              <div className="form-grid">
                <label>
                  Latitude
                  <input
                    name="latitude"
                    type="number"
                    min="47"
                    max="56"
                    step="0.000001"
                    placeholder="52.520000"
                    required
                  />
                </label>
                <label>
                  Longitude
                  <input
                    name="longitude"
                    type="number"
                    min="5"
                    max="16"
                    step="0.000001"
                    placeholder="13.405000"
                    required
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Land status
                  <select name="landStatus" defaultValue={search.landStatus ?? "unknown"}>
                    <option value="unknown">Not yet established</option>
                    <option value="identified">Site identified</option>
                    <option value="optioned">Land option secured</option>
                    <option value="controlled">Land controlled</option>
                  </select>
                </label>
                <label>
                  Planning status
                  <select name="planningStatus" defaultValue={search.planningStatus ?? "unknown"}>
                    <option value="unknown">Not yet established</option>
                    <option value="not_started">Not started</option>
                    <option value="pre_application">Pre-application</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset data-step="2" hidden={step !== 2}>
              <legend>What power envelope does the project need?</legend>
              <p>
                Declare the requirement and the lowest viable starting point. These values are not
                evidence of available network capacity.
              </p>
              <div className="form-grid three-columns">
                <label>
                  Requested import (MW)
                  <input
                    name="importMw"
                    type="number"
                    min="0.001"
                    step="0.001"
                    defaultValue={search.importMw ?? ""}
                    required
                  />
                </label>
                <label>
                  Minimum viable import (MW)
                  <input
                    name="minimumViableImportMw"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={search.minimumViableImportMw}
                  />
                </label>
                <label>
                  Requested export (MW)
                  <input
                    name="exportMw"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={search.exportMw ?? 0}
                    required
                  />
                </label>
              </div>
              {showBattery ? (
                <div className="form-grid">
                  <label>
                    Battery power (MW)
                    <input
                      name="batteryPowerMw"
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue={search.batteryPowerMw}
                    />
                  </label>
                  <label>
                    Battery energy (MWh)
                    <input
                      name="batteryEnergyMwh"
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue={search.batteryEnergyMwh}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <input type="hidden" name="batteryPowerMw" value="" />
                  <input type="hidden" name="batteryEnergyMwh" value="" />
                </>
              )}
              <div className="form-grid">
                <label>
                  Target connection date
                  <input name="targetDate" type="date" defaultValue={search.targetDate} />
                </label>
                <label>
                  Indicative voltage level (kV)
                  <input
                    name="voltageKv"
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="e.g. 110"
                  />
                </label>
              </div>
              <label>
                Continuity requirement
                <select name="redundancyRequirement" defaultValue="unknown">
                  <option value="unknown">Not yet established</option>
                  <option value="interruptible">
                    Load can be interrupted under agreed conditions
                  </option>
                  <option value="n">Single connection is acceptable</option>
                  <option value="n-1">N-1 redundancy required</option>
                  <option value="dual_feed">Independent dual feed required</option>
                </select>
              </label>
              <div className="truth-callout">
                <Info />
                <span>
                  <b>
                    Flexible connection agreements are a pathway to test—not a promised outcome.
                  </b>{" "}
                  The network operator must establish whether static, dynamic or staged limits are
                  technically possible.
                </span>
              </div>
            </fieldset>

            <fieldset data-step="3" hidden={step !== 3}>
              <legend>Confirm the declared project facts</legend>
              <p>
                GridPulse will create a private screening workspace and clearly mark every item that
                still requires operator evidence.
              </p>
              <div className="review-grid">
                <div>
                  <small>Project</small>
                  <b>{review.name}</b>
                  <span>{type}</span>
                </div>
                <div>
                  <small>Location</small>
                  <b>
                    {review.municipality}, {review.federalState}
                  </b>
                  <span>{review.postcode}</span>
                </div>
                <div>
                  <small>Requested connection</small>
                  <b>{review.importMw} MW import</b>
                  <span>{review.exportMw || "0"} MW export</span>
                </div>
                <div>
                  <small>Viable first stage</small>
                  <b>
                    {review.minimumViableImportMw
                      ? `${review.minimumViableImportMw} MW`
                      : "Not declared"}
                  </b>
                  <span>Operator validation required</span>
                </div>
                <div>
                  <small>Project maturity</small>
                  <b>{review.landStatus?.replaceAll("_", " ")}</b>
                  <span>Planning: {review.planningStatus?.replaceAll("_", " ")}</span>
                </div>
                <div>
                  <small>Target date</small>
                  <b>{review.targetDate || "Not declared"}</b>
                  <span>Not a confirmed energisation date</span>
                </div>
              </div>
              <div className="review-assurance">
                <ShieldCheck />
                <span>
                  <b>What the first result will show</b> Likely operator responsibility, evidence
                  gaps, candidate connection pathways and the next operator-engagement action. It
                  will not claim available capacity.
                </span>
              </div>
            </fieldset>

            {error ? (
              <div
                className="form-message error-message form-error"
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            ) : null}
            <div className="form-actions intake-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => continueTo(step - 1)}
                disabled={step === 0 || busy}
              >
                <ArrowLeft /> Back
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => continueTo(step + 1)}
                >
                  Continue <ArrowRight />
                </button>
              ) : (
                <button type="submit" className="primary-button" disabled={busy}>
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" />
                      Creating connection case…
                    </>
                  ) : (
                    <>
                      Create Connection Case <ArrowRight />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
          <aside className="intake-guidance">
            <span className="context-label">Step {step + 1} guidance</span>
            <h2>
              {
                [
                  "Define the investment decision",
                  "Confirm the candidate-site context",
                  "Separate the requirement from flexibility",
                  "Review what remains unconfirmed",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "Use facts your project team can stand behind. Supporting evidence can be added after the initial screening.",
                  "Public sources can help route the case, but only the responsible operator can validate the connection point and deliverable capacity.",
                  "The minimum viable import helps compare firm, staged and flexible pathways without assuming any pathway is available.",
                  "The assessment preserves the distinction between customer declarations, public sources, calculations and operator-confirmed evidence.",
                ][step]
              }
            </p>
            <div>
              <ShieldCheck />
              <span>
                Private workspace
                <br />
                <small>Protected by row-level security</small>
              </span>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
