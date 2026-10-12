import { type FormEvent } from "react";

import { Plus,Trash2 } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import {
constrainedReduction,
label,
type CandidateSite,
type IntervalProfile,
type Scenario,
} from "@/lib/assessment-model";

import { type RestrictionWindow } from "@/lib/fca-engine";

import { runCanonicalFcaProfile } from "@/features/analytics/fca-client";

export function Scenarios({
  site,
  scenarios,
  profiles,
  refresh,
}: {
  site: CandidateSite;
  scenarios: Scenario[];
  profiles: IntervalProfile[];
  refresh: () => Promise<void>;
}) {
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const mode = String(f.get("mode"));
    const profile = profiles.find((item) => item.id === String(f.get("profileId")));
    const importLimit = f.get("importLimit") === "" ? null : Number(f.get("importLimit"));
    const exportLimit = f.get("exportLimit") === "" ? null : Number(f.get("exportLimit"));
    const energyValue = Number(f.get("energyValue") || 0);
    const restrictionWindow: RestrictionWindow | null =
      mode === "dynamic_fca"
        ? {
            startHour: Number(f.get("startHour") || 0),
            endHour: Number(f.get("endHour") || 24),
            weekdays: [1, 2, 3, 4, 5],
            importLimitMw: importLimit,
            exportLimitMw: exportLimit,
          }
        : null;
    const analysis = profile
      ? await runCanonicalFcaProfile(
          profile.points,
          mode,
          importLimit,
          exportLimit,
          restrictionWindow,
          energyValue,
        )
      : null;
    const { error } = await supabase.from("connection_scenarios").insert({
      site_id: site.id,
      user_id: site.user_id,
      name: String(f.get("name")),
      connection_mode: mode,
      max_import_mw: importLimit,
      max_export_mw: exportLimit,
      restriction_schedule: restrictionWindow,
      profile_id: profile?.id ?? null,
      energy_value_eur_mwh: energyValue,
      analysis,
      calculation_version: analysis?.calculationVersion ?? "screening-v1",
      status: analysis ? "calculated" : "evidence_incomplete",
      assumptions: ["Limits are user-entered and require operator evidence"],
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Scenario added");
      form.reset();
      await refresh();
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("connection_scenarios").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  return (
    <div className="workspace-columns">
      <form className="product-form" onSubmit={add}>
        <div className="form-section">
          <h2>Add connection scenario</h2>
          <p>Only enter restrictions supported by an offer, study, or explicit assumption.</p>
          <label>
            Scenario name
            <input name="name" required placeholder="Static FCA draft" />
          </label>
          <label>
            Connection mode
            <select name="mode">
              <option value="unrestricted">Unrestricted baseline</option>
              <option value="static_fca">Static FCA</option>
              <option value="dynamic_fca">Dynamic FCA</option>
            </select>
          </label>
          <label>
            Operating profile
            <select name="profileId" defaultValue="">
              <option value="">No profile — MW screening only</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Maximum import (MW)
              <input name="importLimit" type="number" min="0" step="0.001" />
            </label>
            <label>
              Maximum export (MW)
              <input name="exportLimit" type="number" min="0" step="0.001" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Restriction start hour (UTC)
              <input name="startHour" type="number" min="0" max="23" defaultValue="8" />
            </label>
            <label>
              Restriction end hour (UTC)
              <input name="endHour" type="number" min="1" max="24" defaultValue="20" />
            </label>
          </div>
          <label>
            Indicative energy value (EUR/MWh)
            <input name="energyValue" type="number" min="0" step="0.01" defaultValue="0" />
            <small className="field-help">Commercial assumption, not a revenue forecast.</small>
          </label>
        </div>
        <div className="form-actions">
          <span>Calculated reductions are arithmetic, not grid studies.</span>
          <button className="primary-button">
            <Plus />
            Add scenario
          </button>
        </div>
      </form>
      <div className="scenario-list">
        {scenarios.length === 0 ? (
          <div className="portfolio-state">
            <h2>No scenarios yet</h2>
            <p>Add an unrestricted baseline or an evidence-supported FCA case.</p>
          </div>
        ) : (
          scenarios.map((s) => {
            const importReduction = constrainedReduction(site.requested_import_mw, s.max_import_mw);
            const exportReduction = constrainedReduction(site.requested_export_mw, s.max_export_mw);
            return (
              <article className="scenario-card" key={s.id}>
                <div>
                  <span className="evidence evidence-calculation">{label(s.connection_mode)}</span>
                  <button className="icon-button danger-button" onClick={() => void remove(s.id)}>
                    <Trash2 />
                  </button>
                </div>
                <h2>{s.name}</h2>
                <dl className="detail-list">
                  <dt>Import limit</dt>
                  <dd>
                    {s.max_import_mw ?? "Unknown"} {s.max_import_mw != null ? "MW" : ""}
                  </dd>
                  <dt>Import reduction</dt>
                  <dd>{importReduction == null ? "Not calculated" : `${importReduction} MW`}</dd>
                  <dt>Export limit</dt>
                  <dd>
                    {s.max_export_mw ?? "Unknown"} {s.max_export_mw != null ? "MW" : ""}
                  </dd>
                  <dt>Export reduction</dt>
                  <dd>{exportReduction == null ? "Not calculated" : `${exportReduction} MW`}</dd>
                  <dt>Evidence status</dt>
                  <dd>{label(s.status)}</dd>
                  {s.analysis ? (
                    <>
                      <dt>Restricted hours</dt>
                      <dd>{s.analysis.restrictedHours.toLocaleString()} h</dd>
                      <dt>Constrained import</dt>
                      <dd>{s.analysis.constrainedImportMwh.toLocaleString()} MWh</dd>
                      <dt>Constrained export</dt>
                      <dd>{s.analysis.constrainedExportMwh.toLocaleString()} MWh</dd>
                      <dt>Indicative gross impact</dt>
                      <dd>€{s.analysis.estimatedGrossImpactEur.toLocaleString()}</dd>
                    </>
                  ) : null}
                </dl>
                <small>Calculation version: {s.calculation_version}</small>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
