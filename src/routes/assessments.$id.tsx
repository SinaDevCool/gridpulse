import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  constrainedReduction,
  label,
  readiness,
  type CandidateSite,
  type Evidence,
  type IntervalProfile,
  type Scenario,
} from "@/lib/assessment-model";
import {
  analyseFca,
  parseIntervalCsv,
  summarizeProfile,
  type RestrictionWindow,
} from "@/lib/fca-engine";
import { screenGermanOperator } from "@/lib/german-grid-screening";

export const Route = createFileRoute("/assessments/$id")({ component: AssessmentPage });
type Tab = "overview" | "evidence" | "profile" | "scenarios" | "report";

function AssessmentPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["assessment", id, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [siteResult, evidenceResult, scenarioResult, profileResult] = await Promise.all([
        supabase.from("candidate_sites").select("*").eq("id", id).single(),
        supabase
          .from("assessment_evidence")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("connection_scenarios")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("interval_profiles")
          .select("*")
          .eq("site_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (evidenceResult.error) throw evidenceResult.error;
      if (scenarioResult.error) throw scenarioResult.error;
      if (profileResult.error) throw profileResult.error;
      return {
        site: siteResult.data as CandidateSite,
        evidence: evidenceResult.data as Evidence[],
        scenarios: scenarioResult.data as Scenario[],
        profiles: profileResult.data as IntervalProfile[],
      };
    },
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["assessment", id] });
    await queryClient.invalidateQueries({ queryKey: ["candidate-sites"] });
  }
  if (query.isLoading)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <div className="loading-spinner" />
          <p>Loading assessment…</p>
        </main>
      </AppShell>
    );
  if (query.error || !query.data)
    return (
      <AppShell requireAuth>
        <main className="auth-gate">
          <AlertTriangle />
          <h1>Assessment unavailable</h1>
          <p>
            {query.error instanceof Error
              ? query.error.message
              : "This record does not exist or is not accessible."}
          </p>
          <Link to="/portfolio" className="primary-button">
            Return to portfolio
          </Link>
        </main>
      </AppShell>
    );
  const { site, evidence, scenarios, profiles } = query.data;
  const ready = readiness(evidence);
  async function archive() {
    setBusy(true);
    const { error } = await supabase
      .from("candidate_sites")
      .update({ assessment_status: "archived" })
      .eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Assessment archived");
      await refresh();
    }
  }
  async function remove() {
    if (!window.confirm("Permanently delete this assessment and all evidence?")) return;
    setBusy(true);
    const { error } = await supabase.from("candidate_sites").delete().eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message);
    else await navigate({ to: "/portfolio" });
  }
  return (
    <AppShell requireAuth>
      <main className="section-page assessment-workspace">
        <Link to="/portfolio" className="back-link">
          <ArrowLeft />
          Portfolio
        </Link>
        <header className="assessment-title">
          <div>
            <p className="context-label">Assessment / {site.id.slice(0, 8)}</p>
            <h1>{site.name}</h1>
            <p>
              {label(site.project_type)} · {site.latitude}, {site.longitude}
            </p>
          </div>
          <div>
            <span className="status warning-text">{label(site.assessment_status)}</span>
            <button onClick={archive} disabled={busy}>
              <Archive />
              Archive
            </button>
            <button className="danger-button" onClick={remove} disabled={busy}>
              <Trash2 />
              Delete
            </button>
          </div>
        </header>
        <div className="readiness-strip">
          <div>
            <span>{ready.completed}/3</span>
            <div>
              <b>Report readiness</b>
              <small>
                {ready.ready ? "Required evidence satisfied" : "Evidence validation incomplete"}
              </small>
            </div>
          </div>
          {[
            [ready.official, "Official source"],
            [ready.customer, "Customer input"],
            [ready.operator, "Operator validation"],
          ].map(([done, text]) => (
            <span className={done ? "ready-item done" : "ready-item"} key={String(text)}>
              {done ? <Check /> : <AlertTriangle />}
              {text}
            </span>
          ))}
        </div>
        <nav className="workspace-tabs">
          {(["overview", "evidence", "profile", "scenarios", "report"] as Tab[]).map((item) => (
            <button
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
              key={item}
            >
              {label(item)}
            </button>
          ))}
        </nav>
        {tab === "overview" ? (
          <Overview site={site} busy={busy} setBusy={setBusy} refresh={refresh} />
        ) : tab === "evidence" ? (
          <EvidenceRoom site={site} evidence={evidence} refresh={refresh} />
        ) : tab === "profile" ? (
          <ProfileRoom site={site} profiles={profiles} refresh={refresh} />
        ) : tab === "scenarios" ? (
          <Scenarios site={site} scenarios={scenarios} profiles={profiles} refresh={refresh} />
        ) : (
          <Report site={site} evidence={evidence} scenarios={scenarios} profiles={profiles} />
        )}
      </main>
    </AppShell>
  );
}

function Overview({
  site,
  busy,
  setBusy,
  refresh,
}: {
  site: CandidateSite;
  busy: boolean;
  setBusy: (v: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const screening = screenGermanOperator(site.latitude, site.longitude);
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
              Suggested transmission-area context: {screening.transmissionOperator}. Screening only;
              confirm the responsible DSO and connection point.
            </small>
          </label>
          <label>
            Confirmation status
            <select name="operatorStatus" defaultValue={site.operator_status}>
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
  );
}

function ProfileRoom({
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
  const [points, setPoints] = useState<ReturnType<typeof parseIntervalCsv>>([]);
  const [filename, setFilename] = useState("");
  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseIntervalCsv(await file.text());
      setPoints(parsed);
      setPreview(summarizeProfile(parsed));
      setFilename(file.name);
    } catch (error) {
      setPoints([]);
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Unable to parse profile");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || points.length === 0) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("interval_profiles").insert({
      site_id: site.id,
      user_id: site.user_id,
      name: String(form.get("name")),
      source_filename: filename,
      interval_minutes: preview.intervalMinutes,
      period_start: preview.periodStart,
      period_end: preview.periodEnd,
      interval_count: preview.intervalCount,
      peak_import_mw: preview.peakImportMw,
      peak_export_mw: preview.peakExportMw,
      points,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Operating profile saved");
      setPoints([]);
      setPreview(null);
      setFilename("");
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
          <label className="file-drop">
            <Upload />
            <b>{filename || "Choose interval CSV"}</b>
            <span>Columns: timestamp, import_mw, export_mw</span>
            <input
              type="file"
              accept=".csv,text/csv"
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
            </dl>
          ) : null}
        </div>
        <div className="form-actions">
          <span>Operational data remains private to your account.</span>
          <button className="primary-button" disabled={busy || !preview}>
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

function EvidenceRoom({
  site,
  evidence,
  refresh,
}: {
  site: CandidateSite;
  evidence: Evidence[];
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const f = new FormData(event.currentTarget);
    const { error } = await supabase.from("assessment_evidence").insert({
      site_id: site.id,
      user_id: site.user_id,
      title: String(f.get("title")),
      classification: String(f.get("classification")),
      source_name: String(f.get("sourceName") || "") || null,
      source_url: String(f.get("sourceUrl") || "") || null,
      observed_at: String(f.get("observedAt") || "") || null,
      confidence: String(f.get("confidence")),
      validation_status: String(f.get("status")),
      notes: String(f.get("notes") || "") || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setOpen(false);
      toast.success("Evidence added");
      await refresh();
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("assessment_evidence").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  async function setStatus(id: string, validation_status: string) {
    const { error } = await supabase
      .from("assessment_evidence")
      .update({ validation_status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }
  return (
    <div className="workspace-stack">
      <div className="workspace-toolbar">
        <div>
          <h2>Evidence ledger</h2>
          <p>Every item has an explicit source and validation state.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen((v) => !v)}>
          <Plus />
          Add evidence
        </button>
      </div>
      {open ? (
        <form className="inline-editor" onSubmit={add}>
          <label>
            Evidence title
            <input name="title" required placeholder="e.g. Operator connection rules" />
          </label>
          <div className="form-grid">
            <label>
              Classification
              <select name="classification">
                <option value="official_source">Official source</option>
                <option value="customer_input">Customer input</option>
                <option value="assumption">Assumption</option>
                <option value="calculation">Calculation</option>
                <option value="operator_validation_required">Operator validation required</option>
              </select>
            </label>
            <label>
              Validation status
              <select name="status">
                <option value="collected">Collected</option>
                <option value="unverified">Unverified</option>
                <option value="validated">Validated</option>
                <option value="missing">Missing</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Source name
              <input name="sourceName" />
            </label>
            <label>
              Source URL
              <input name="sourceUrl" type="url" placeholder="https://" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Observed date
              <input name="observedAt" type="date" />
            </label>
            <label>
              Confidence
              <select name="confidence">
                <option value="unknown">Unknown</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <div className="editor-actions">
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="primary-button" disabled={busy}>
              Save evidence
            </button>
          </div>
        </form>
      ) : null}
      <div className="data-panel">
        <div className="table-scroll">
          <table className="product-table">
            <thead>
              <tr>
                <th>Evidence</th>
                <th>Source</th>
                <th>Classification</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {evidence.length === 0 ? (
                <tr>
                  <td colSpan={5}>No evidence has been recorded.</td>
                </tr>
              ) : (
                evidence.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.title}</b>
                      <small>{item.notes}</small>
                    </td>
                    <td>
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          {item.source_name || "Open source"} <ExternalLink />
                        </a>
                      ) : (
                        item.source_name || "—"
                      )}
                    </td>
                    <td>
                      <span className="evidence evidence-input">{label(item.classification)}</span>
                    </td>
                    <td>
                      <select
                        className="table-select"
                        value={item.validation_status}
                        onChange={(event) => void setStatus(item.id, event.target.value)}
                        aria-label={`Validation status for ${item.title}`}
                      >
                        <option value="unverified">Unverified</option>
                        <option value="collected">Collected</option>
                        <option value="validated">Validated</option>
                        <option value="missing">Missing</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="icon-button danger-button"
                        onClick={() => void remove(item.id)}
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Scenarios({
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
      ? analyseFca(profile.points, mode, importLimit, exportLimit, restrictionWindow, energyValue)
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

function Report({
  site,
  evidence,
  scenarios,
  profiles,
}: {
  site: CandidateSite;
  evidence: Evidence[];
  scenarios: Scenario[];
  profiles: IntervalProfile[];
}) {
  const state = readiness(evidence);
  return (
    <article className="print-report">
      <header>
        <div>
          <p className="context-label">GridPulse pre-feasibility report</p>
          <h1>{site.name}</h1>
          <p>Generated {new Date().toLocaleDateString()} · Preliminary decision support</p>
        </div>
        <button
          className="primary-button no-print"
          onClick={() => window.print()}
          disabled={!state.ready}
        >
          <FileText />
          Print / save PDF
        </button>
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
            {site.likely_network_operator ?? "Not confirmed"} ({label(site.operator_status)})
          </dd>
        </dl>
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
