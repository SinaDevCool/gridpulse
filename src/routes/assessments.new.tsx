import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Info, LoaderCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/assessments/new")({ component: NewAssessment });
const steps = ["Project", "Location", "Connection", "Evidence"];
const projectTypes = {
  BESS: "bess",
  "Large electrical load": "large_load",
  "Co-located BESS + load": "co_location",
} as const;

function NewAssessment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState<keyof typeof projectTypes>("BESS");
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
      target_voltage_kv: Number(form.get("voltageKv")) || null,
    };
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
                    defaultValue="0"
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
                    defaultValue="0"
                    required
                  />
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
