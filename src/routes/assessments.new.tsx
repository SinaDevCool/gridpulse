import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Info, LoaderCircle, MapPin } from "lucide-react";
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
    exportMw: z.coerce.number().min(0).optional(),
    batteryPowerMw: z.coerce.number().min(0).optional(),
    batteryEnergyMwh: z.coerce.number().min(0).optional(),
    targetDate: z.string().optional(),
    challenge: z.string().max(3000).optional(),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: NewAssessment,
});
const steps = ["Project", "Location", "Connection", "Evidence"];
const projectTypes = {
  BESS: "bess",
  "Large electrical load": "large_load",
  "Co-located BESS + load": "co_location",
} as const;

function NewAssessment() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialType =
    (Object.entries(projectTypes).find(([, value]) => value === search.projectType)?.[0] as
      | keyof typeof projectTypes
      | undefined) ?? "BESS";
  const [type, setType] = useState<keyof typeof projectTypes>(initialType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      user_id: user.id,
      name: String(form.get("name") ?? "").trim(),
      project_type: projectTypes[type],
      latitude: Number(form.get("latitude")),
      longitude: Number(form.get("longitude")),
      requested_import_mw: Number(form.get("importMw") || 0),
      requested_export_mw: Number(form.get("exportMw") || 0),
      bess_power_mw: Number(form.get("batteryPowerMw")) || null,
      bess_energy_mwh: Number(form.get("batteryEnergyMwh")) || null,
      target_voltage_kv: Number(form.get("voltageKv")) || null,
      target_energization_date: String(form.get("targetDate") || "") || null,
      postcode: String(form.get("postcode") || "") || null,
      municipality: String(form.get("municipality") || "") || null,
      federal_state: String(form.get("federalState") || "") || null,
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
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const { error: profileError } = await supabase.rpc("apply_operator_profile", {
      p_site_id: created.id,
      p_profile_key: screening.profileKey,
    });
    if (profileError) {
      toast.warning("Assessment created, but operator routing needs review");
    }
    if (search.pilotRequestId) {
      const { error: requestError } = await supabase
        .from("pilot_requests")
        .update({ status: "converted" })
        .eq("id", search.pilotRequestId);
      if (requestError) toast.warning("Assessment created; update the pilot request manually");
    }
    toast.success("Assessment draft created");
    await navigate({ to: "/assessments/$id", params: { id: created.id } });
  }

  return (
    <AppShell requireAuth>
      <main className="section-page narrow-page">
        <PageHeading
          eyebrow="New connection assessment"
          title="Define the project requirement"
          description="Begin with declared inputs. GridPulse will classify later outputs by evidence quality."
        />
        <div className="form-steps">
          {steps.map((step, index) => (
            <div className={index === 0 ? "active" : ""} key={step}>
              <span>{index === 0 ? <Check /> : index + 1}</span>
              {step}
            </div>
          ))}
        </div>
        <div className="form-layout">
          <form className="product-form" onSubmit={createAssessment}>
            <div className="form-section">
              <h2>Project details</h2>
              <p>Describe the asset requesting a grid connection.</p>
              <label>
                Project name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="e.g. Brandenburg BESS"
                  defaultValue={search.name}
                />
              </label>
              <label>
                Project type
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as keyof typeof projectTypes)}
                >
                  {Object.keys(projectTypes).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-section">
              <h2>Connection requirement</h2>
              <p>Enter requested capacity—not assumed available capacity.</p>
              <div className="form-grid">
                <label>
                  Requested import (MW)
                  <input
                    name="importMw"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={search.importMw ?? 0}
                    required
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
              {type === "BESS" || type === "Co-located BESS + load" ? (
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
              ) : null}
              <div className="form-grid">
                <label>
                  Postcode
                  <input
                    name="postcode"
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    defaultValue={search.postcode}
                  />
                </label>
                <label>
                  Municipality
                  <input name="municipality" defaultValue={search.municipality} />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Federal state
                  <input name="federalState" defaultValue={search.federalState} />
                </label>
                <label>
                  Target connection date
                  <input name="targetDate" type="date" defaultValue={search.targetDate} />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Latitude (Germany)
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
                  Longitude (Germany)
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
              <label>
                Target voltage (kV)
                <input name="voltageKv" type="number" min="0.001" step="0.001" placeholder="110" />
              </label>
              <label>
                Connection challenge
                <textarea
                  name="challenge"
                  rows={4}
                  defaultValue={search.challenge}
                  placeholder="Operator feedback, missing evidence or decision gate"
                />
              </label>
            </div>
            {error ? <div className="form-message error-message form-error">{error}</div> : null}
            <div className="form-actions">
              <span>Drafts are private and protected by row-level security.</span>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle className="spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create assessment <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
          <aside className="guidance-card">
            <MapPin />
            <h2>What happens next?</h2>
            <ol>
              <li>Locate the project and nearby public infrastructure.</li>
              <li>Screen the likely responsible network operator.</li>
              <li>Collect official and customer-supplied evidence.</li>
              <li>Model only restrictions supported by evidence.</li>
            </ol>
            <div>
              <Info />
              GridPulse never treats proximity to a substation as confirmation of capacity.
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
