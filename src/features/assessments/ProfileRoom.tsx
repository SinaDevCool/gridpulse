import { useState,type FormEvent } from "react";

import { LoaderCircle,Trash2,Upload } from "lucide-react";

import { toast } from "sonner";

import { buildProfileQualityReport } from "@/features/grid-connection/phase45";

import { importIntervalFile } from "@/features/grid-connection/profile-import";

import { supabase } from "@/integrations/supabase/client";

import { label,type CandidateSite,type IntervalProfile } from "@/lib/assessment-model";

import { summarizeProfile,type IntervalPoint } from "@/lib/fca-engine";

export function ProfileRoom({
  site,
  profiles,
  refresh,
}: {
  site: CandidateSite;
  profiles: IntervalProfile[];
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof summarizeProfile> | null>(null);
  const [quality, setQuality] = useState<ReturnType<typeof buildProfileQualityReport> | null>(null);
  const [points, setPoints] = useState<IntervalPoint[]>([]);
  const [filename, setFilename] = useState("");
  const [sourceHash, setSourceHash] = useState("");
  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      const source = await file.arrayBuffer();
      const parsed = await importIntervalFile(file);
      const digest = await crypto.subtle.digest("SHA-256", source);
      setSourceHash(
        Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
      );
      setPoints(parsed);
      setPreview(summarizeProfile(parsed));
      setQuality(buildProfileQualityReport(parsed));
      setFilename(file.name);
    } catch (error) {
      setPoints([]);
      setPreview(null);
      setQuality(null);
      toast.error(error instanceof Error ? error.message : "Unable to parse profile");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || points.length === 0) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const profileName = String(form.get("name"));
    const previous = await supabase
      .from("interval_profiles")
      .select("id,version")
      .eq("site_id", site.id)
      .eq("name", profileName)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous.error) {
      setBusy(false);
      toast.error(previous.error.message);
      return;
    }
    const { error } = await supabase.from("interval_profiles").insert({
      site_id: site.id,
      user_id: site.user_id,
      name: profileName,
      source_filename: filename,
      interval_minutes: preview.intervalMinutes,
      period_start: preview.periodStart,
      period_end: preview.periodEnd,
      interval_count: preview.intervalCount,
      peak_import_mw: preview.peakImportMw,
      peak_export_mw: preview.peakExportMw,
      points,
      timezone: String(form.get("timezone")),
      quality_status: quality?.status === "blocked" ? "rejected" : quality?.status,
      quality_report: quality ?? {},
      calculation_version: "profile-quality-v2",
      version: (previous.data?.version ?? 0) + 1,
      supersedes_id: previous.data?.id ?? null,
      source_hash: sourceHash || null,
      source_classification: "customer_input",
      column_mapping: {
        timestamp: "timestamp",
        importMw: "import_mw",
        exportMw: "export_mw",
        flexibleLoadMw: "flexible_load_mw (optional)",
        onsiteGenerationMw: "onsite_generation_mw (optional)",
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Operating profile saved");
      setPoints([]);
      setPreview(null);
      setQuality(null);
      setFilename("");
      setSourceHash("");
      await refresh();
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("interval_profiles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  return (
    <div className="workspace-columns">
      <form className="product-form" onSubmit={save}>
        <div className="form-section">
          <h2>Upload operating profile</h2>
          <p>Use 15, 30, or 60-minute intervals. Times are normalized to UTC for calculation.</p>
          <label>
            Profile name
            <input name="name" required placeholder="2027 reference dispatch" />
          </label>
          <label>
            Source timezone
            <select name="timezone" defaultValue="Europe/Berlin">
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
          <label className="file-drop">
            <Upload />
            <b>{filename || "Choose interval CSV or XLSX"}</b>
            <span>Columns: timestamp and import/load or export/generation · MW or kW</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
          </label>
          <a className="template-link" href="/example-operating-profile.csv" download>
            Download CSV template
          </a>
          {preview ? (
            <dl className="profile-preview detail-list">
              <dt>Intervals</dt>
              <dd>{preview.intervalCount.toLocaleString()}</dd>
              <dt>Resolution</dt>
              <dd>{preview.intervalMinutes} minutes</dd>
              <dt>Peak import</dt>
              <dd>{preview.peakImportMw} MW</dd>
              <dt>Peak export</dt>
              <dd>{preview.peakExportMw} MW</dd>
              <dt>Quality</dt>
              <dd>{quality?.status === "blocked" ? "Needs correction" : "Calculation ready"}</dd>
              <dt>Annualised consumption</dt>
              <dd>{quality?.annualisedConsumptionMwh.toLocaleString()} MWh</dd>
              <dt>Load factor</dt>
              <dd>{Math.round((quality?.loadFactor ?? 0) * 100)}%</dd>
            </dl>
          ) : null}
          {quality?.warnings.map((warning) => (
            <p className="model-warning" key={warning}>
              {warning}
            </p>
          ))}
        </div>
        <div className="form-actions">
          <span>Operational data remains private to your account.</span>
          <button
            className="primary-button"
            disabled={busy || !preview || quality?.status === "blocked"}
          >
            {busy ? <LoaderCircle className="spin" /> : <Upload />} Save profile
          </button>
        </div>
      </form>
      <div className="scenario-list">
        {profiles.length === 0 ? (
          <div className="portfolio-state">
            <Upload />
            <h2>No profile uploaded</h2>
            <p>Add a profile to calculate energy and commercial impacts.</p>
          </div>
        ) : (
          profiles.map((profile) => (
            <article className="scenario-card" key={profile.id}>
              <div>
                <span className="evidence evidence-input">Operating profile</span>
                <button
                  className="icon-button danger-button"
                  onClick={() => void remove(profile.id)}
                >
                  <Trash2 />
                </button>
              </div>
              <h2>{profile.name}</h2>
              <dl className="detail-list">
                <dt>Resolution</dt>
                <dd>{profile.interval_minutes} minutes</dd>
                <dt>Coverage</dt>
                <dd>
                  {new Date(profile.period_start).toLocaleDateString()} –{" "}
                  {new Date(profile.period_end).toLocaleDateString()}
                </dd>
                <dt>Intervals</dt>
                <dd>{profile.interval_count.toLocaleString()}</dd>
                <dt>Data quality</dt>
                <dd>{label(profile.quality_status || "unreviewed")}</dd>
                <dt>Peak import / export</dt>
                <dd>
                  {profile.peak_import_mw} / {profile.peak_export_mw} MW
                </dd>
              </dl>
              <small>{profile.source_filename}</small>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
