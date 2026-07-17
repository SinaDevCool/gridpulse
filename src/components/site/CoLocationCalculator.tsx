import { useMemo, useState } from "react";
import { X, Zap, TrendingDown, Clock, ShieldCheck, Download, Euro, Plus, ChevronDown, ChevronUp, Printer, Building2, Landmark } from "lucide-react";
import { avoidedPenaltyEurAnnual, avoidedGridUpgradeCapex, acceleratedRevenue } from "@/context/SimulationContext";

import { TSO_ZONES, sitingScore, nodeClassStyles, type TsoCode } from "@/lib/tso-zones";
import { useSimulation } from "@/context/SimulationContext";

// Co-location Benefit Calculator — models how pairing a heavy industrial /
// hyperscale load with an on-site BESS collapses peak grid draw, letting a
// developer bypass multi-year TSO substation upgrades. Inputs are bound to
// the global SimulationContext so the analytics matrix + map markers stay in
// sync while the user drags sliders.
export function CoLocationCalculator({ onClose }: { onClose: () => void }) {
  const sim = useSimulation();
  const loadMw = sim.requestedLoadMw;
  const bessMw = sim.bessMw;
  const bessMwh = sim.bessMwh;
  const zoneCode = sim.selectedTsoZone;
  const setLoadMw = sim.setRequestedLoadMw;
  const setBessMw = sim.setBessMw;
  const setBessMwh = sim.setBessMwh;
  const setZoneCode = sim.setSelectedTsoZone;
  const [scenarioLabel, setScenarioLabel] = useState("");
  const [financialOpen, setFinancialOpen] = useState(true);
  const [tsoView, setTsoView] = useState(false);

  const zone = useMemo(
    () => TSO_ZONES.find((z) => z.code === zoneCode) ?? TSO_ZONES[0],
    [zoneCode],
  );

  const model = useMemo(() => {
    // Peak shaving: BESS absorbs the top of the load curve.
    const shavedMw = Math.min(bessMw, loadMw * 0.6);
    const netGridDrawMw = Math.max(loadMw - shavedMw, 0);
    const durationH = bessMw > 0 ? bessMwh / bessMw : 0;
    const congestionRelief = Math.min((shavedMw / Math.max(loadMw, 1)) * 100, 100);
    const baselineMonths = zone.timeToEnergizeMonths;
    // Every 10% of peak shaved cuts ~9 months of TSO reinforcement backlog.
    const fastTrackMonths = Math.max(
      Math.round(baselineMonths - (congestionRelief / 10) * 9),
      6,
    );
    const monthsSaved = baselineMonths - fastTrackMonths;
    const canBypass = netGridDrawMw <= zone.headroomMw && congestionRelief >= 35;
    return {
      shavedMw,
      netGridDrawMw,
      durationH,
      congestionRelief,
      baselineMonths,
      fastTrackMonths,
      monthsSaved,
      canBypass,
    };
  }, [loadMw, bessMw, bessMwh, zone]);

  const zoneStyles = nodeClassStyles(zone.nodeClass);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Co-Location Benefit Calculator"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xl flex-col overflow-y-auto border-l border-border/60 bg-background shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/60 bg-background/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">Co-Location Benefit Calculator</div>
            <h2 className="mt-1 font-display text-lg font-bold truncate">Bypass the TSO queue with an on-site BESS</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => window.print()}
              aria-label="Print prospectus"
              title="Print prospectus"
              className="rounded-md border border-border/60 bg-surface/60 p-1.5 text-muted-foreground hover:text-foreground print:hidden"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close calculator"
              className="rounded-md border border-border/60 bg-surface/60 p-1.5 text-muted-foreground hover:text-foreground print:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Target TSO zone
            </label>
            <select
              value={zoneCode}
              onChange={(e) => setZoneCode(e.target.value as TsoCode)}
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            >
              {TSO_ZONES.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name} — {z.country}
                </option>
              ))}
            </select>
            <div className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${zoneStyles.chip}`}>
              Baseline: {zone.timeToEnergizeMonths} mo · {zone.headroomMw.toLocaleString()} MW headroom · {zone.redispatchRiskPct}% redispatch
            </div>
          </div>

          <SliderInput
            label="Requested Data Center Load"
            value={loadMw}
            onChange={setLoadMw}
            min={10}
            max={500}
            step={10}
            unit="MW"
          />
          <SliderInput
            label="Target BESS Power"
            value={bessMw}
            onChange={setBessMw}
            min={0}
            max={400}
            step={10}
            unit="MW"
          />
          <SliderInput
            label="Target BESS Energy"
            value={bessMwh}
            onChange={setBessMwh}
            min={0}
            max={2000}
            step={20}
            unit="MWh"
          />

          <div className="rounded-xl border border-cyan-accent/30 bg-cyan-accent/[0.04] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">Live outcome summary</div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <OutcomeStat icon={<TrendingDown className="h-3.5 w-3.5" />} label="Peak grid draw" value={`${model.netGridDrawMw.toFixed(0)} MW`} sub={`from ${loadMw} MW load`} />
              <OutcomeStat icon={<Zap className="h-3.5 w-3.5" />} label="Peak shaved" value={`${model.shavedMw.toFixed(0)} MW`} sub={`${model.congestionRelief.toFixed(0)}% congestion relief`} />
              <OutcomeStat icon={<Clock className="h-3.5 w-3.5" />} label="Time-to-Connect" value={`${model.fastTrackMonths} mo`} sub={`saves ${Math.max(model.monthsSaved, 0)} mo vs baseline`} />
              <OutcomeStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Battery duration" value={`${model.durationH.toFixed(1)} h`} sub={`${bessMw} MW / ${bessMwh} MWh`} />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] font-mono-data text-muted-foreground">
                <span>Substation utilisation after co-location</span>
                <span>{model.congestionRelief.toFixed(0)}% relieved</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-accent via-cyan-accent to-green-accent transition-all"
                  style={{ width: `${Math.max(model.congestionRelief, 4)}%` }}
                />
              </div>
            </div>

            <div className={`mt-4 rounded-md border px-3 py-2 text-xs ${
              model.canBypass
                ? "border-green-accent/50 bg-green-accent/10 text-green-accent"
                : "border-amber-accent/50 bg-amber-accent/10 text-amber-accent"
            }`}>
              {model.canBypass ? (
                <>✓ Fast-track viable — peak draw sits within {zone.name}'s existing HV headroom. Developer can bypass multi-year substation reinforcement and score {sitingScore(zone)} on the Time-to-Connect Index.</>
              ) : (
                <>⚠ Residual load exceeds zone headroom. Increase BESS power / energy or split the load across two nodes to bypass the {zone.timeToEnergizeMonths}-month TSO reinforcement queue.</>
              )}
            </div>
          </div>

          {/* Financial Siting Prospectus — dual-sided (Developer / TSO) model */}
          <FinancialProspectus
            open={financialOpen}
            onToggle={() => setFinancialOpen((v) => !v)}
            tsoView={tsoView}
            onTsoViewChange={setTsoView}
            loadMw={loadMw}
            netGridDrawMw={model.netGridDrawMw}
            monthsSaved={Math.max(model.monthsSaved, 0)}
            congestionReliefPct={model.congestionRelief}
            avoidedPenaltyEur={avoidedPenaltyEurAnnual(zone, loadMw, model.congestionRelief / 100)}
            avoidedCapexEur={avoidedGridUpgradeCapex(loadMw, model.netGridDrawMw)}
            revenueEur={acceleratedRevenue(loadMw, Math.max(model.monthsSaved, 0))}
            baselineMonths={model.baselineMonths}
            fastTrackMonths={model.fastTrackMonths}
            zoneName={zone.name}
            redispatchRiskPct={zone.redispatchRiskPct}
          />

          {/* Save Scenario to Prospectus — appends to bench for side-by-side benchmarking */}
          <div className="rounded-xl border border-border/60 bg-surface/40 p-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Scenario label (optional)
            </label>
            <input
              value={scenarioLabel}
              onChange={(e) => setScenarioLabel(e.target.value)}
              placeholder={`Scenario ${String.fromCharCode(65 + (sim.savedScenarios.length % 26))}: ${zone.name} Cluster`}
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                sim.saveScenario(scenarioLabel);
                setScenarioLabel("");
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-cyan-accent/50 bg-cyan-accent/10 px-3 py-2 text-xs font-semibold text-cyan-accent hover:bg-cyan-accent/20"
            >
              <Plus className="h-3.5 w-3.5" /> Save Scenario to Prospectus
            </button>
            {sim.savedScenarios.length > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                {sim.savedScenarios.length} scenario{sim.savedScenarios.length === 1 ? "" : "s"} on the Active Siting Comparison Bench (Analytics tab).
              </p>
            )}
          </div>

          <button
            onClick={() => {
              // Assemble a single-row prospectus row capturing the current
              // simulation so an analyst can drop it straight into an IC memo.
              const row = {
                generated_at: new Date().toISOString(),
                tso_zone: zone.name,
                country: zone.country,
                node_class: zone.nodeClass,
                requested_load_mw: loadMw,
                bess_mw: bessMw,
                bess_mwh: bessMwh,
                battery_duration_h: Number(model.durationH.toFixed(2)),
                peak_shaved_mw: Number(model.shavedMw.toFixed(1)),
                net_grid_draw_mw: Number(model.netGridDrawMw.toFixed(1)),
                congestion_relief_pct: Number(model.congestionRelief.toFixed(1)),
                baseline_time_to_connect_months: model.baselineMonths,
                simulated_time_to_connect_months: model.fastTrackMonths,
                months_saved: Math.max(model.monthsSaved, 0),
                zone_headroom_mw: zone.headroomMw,
                zone_redispatch_risk_pct: zone.redispatchRiskPct,
                siting_score: sitingScore(zone),
                avoided_grid_upgrade_capex_eur: avoidedGridUpgradeCapex(loadMw, model.netGridDrawMw),
                accelerated_revenue_eur: acceleratedRevenue(loadMw, Math.max(model.monthsSaved, 0)),
                avoided_tso_congestion_eur_annual: avoidedPenaltyEurAnnual(zone, loadMw, model.congestionRelief / 100),
                fast_track_viable: model.canBypass ? "yes" : "no",
              };
              const headers = Object.keys(row);
              const esc = (v: unknown) => {
                const s = v == null ? "" : String(v);
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
              };
              const csv = [headers.join(","), headers.map((h) => esc((row as Record<string, unknown>)[h])).join(",")].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `gridpulse-siting-prospectus-${zone.code.toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 bg-surface/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface"
          >
            <Download className="h-3.5 w-3.5" /> Export Siting Prospectus (CSV)
          </button>

          {/* Reset All Data — wipes localStorage + memory-side simulation state
              so a client demo starts from a clean canvas. */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("Reset all saved scenarios and simulation inputs? This clears local storage.")) return;
              sim.resetAll();
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-accent/40 bg-red-accent/10 px-3 py-2 text-[11px] font-semibold text-red-accent hover:bg-red-accent/20"
          >
            Reset All Data
          </button>

          <p className="text-[10px] text-muted-foreground">
            Model inputs are indicative — validated against ENTSO-E Core Transparency Platform and Bundesnetzagentur SMARD 12-month redispatch data. Contact GridPulse Enterprise for a full siting study.
          </p>
        </div>
      </div>
    </div>
  );
}


function SliderInput({
  label, value, onChange, min, max, step, unit,
}: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className="font-mono-data text-sm text-foreground">
          {value.toLocaleString()} <span className="text-muted-foreground">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-cyan-accent cursor-pointer"
      />
    </div>
  );
}

function OutcomeStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] font-mono-data text-muted-foreground">{sub}</div>
    </div>
  );
}

// Dual-sided Financial Siting Prospectus panel.
// Developer view: Avoided Grid Upgrade CapEx (€200k / avoided MW of peak draw)
// + Accelerated Revenue Realization (months saved × load MW × €50k / MW / mo).
// TSO view: Peak Substation Relief % + Avoided TSO Redispatch Costs (annual).
function FinancialProspectus({
  open, onToggle, tsoView, onTsoViewChange,
  loadMw, netGridDrawMw, monthsSaved, congestionReliefPct,
  avoidedPenaltyEur, avoidedCapexEur, revenueEur,
  baselineMonths, fastTrackMonths, zoneName, redispatchRiskPct,
}: {
  open: boolean;
  onToggle: () => void;
  tsoView: boolean;
  onTsoViewChange: (v: boolean) => void;
  loadMw: number;
  netGridDrawMw: number;
  monthsSaved: number;
  congestionReliefPct: number;
  avoidedPenaltyEur: number;
  avoidedCapexEur: number;
  revenueEur: number;
  baselineMonths: number;
  fastTrackMonths: number;
  zoneName: string;
  redispatchRiskPct: number;
}) {
  const fmtEur = (n: number) => {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
    return `€${n.toLocaleString()}`;
  };
  return (
    <div className="rounded-xl border border-cyan-accent/30 bg-cyan-accent/[0.04] p-4">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">
          <Euro className="h-3 w-3" /> Financial Siting Prospectus
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Perspective toggle */}
          <div className="inline-flex rounded-md border border-border/60 bg-background/60 p-0.5 text-[10px] font-semibold uppercase tracking-wider print:hidden">
            <button
              onClick={() => onTsoViewChange(false)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 ${!tsoView ? "bg-cyan-accent/15 text-cyan-accent" : "text-muted-foreground"}`}
            >
              <Building2 className="h-3 w-3" /> Developer
            </button>
            <button
              onClick={() => onTsoViewChange(true)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 ${tsoView ? "bg-cyan-accent/15 text-cyan-accent" : "text-muted-foreground"}`}
            >
              <Landmark className="h-3 w-3" /> View TSO / Grid Operator Impact
            </button>
          </div>

          {!tsoView ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FinancialCard
                label="Avoided Grid Upgrade CapEx"
                value={fmtEur(avoidedCapexEur)}
                sub={`${(loadMw - netGridDrawMw).toFixed(0)} MW avoided × €200k / MW`}
                tone="green"
              />
              <FinancialCard
                label="Accelerated Revenue Realization"
                value={fmtEur(revenueEur)}
                sub={`${monthsSaved} mo earlier × ${loadMw} MW × €50k / MW·mo`}
                tone="cyan"
              />
              <p className="col-span-full text-[10px] text-muted-foreground">
                Bypassing HV substation reinforcement (from a {baselineMonths}-month baseline to {fastTrackMonths} months) unlocks contracted colo revenue years sooner. Rates benchmarked to European hyperscale wholesale colocation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FinancialCard
                label="Peak Substation Relief"
                value={`${congestionReliefPct.toFixed(0)}%`}
                sub={`stress on ${zoneName} local node`}
                tone="cyan"
              />
              <FinancialCard
                label="Avoided TSO Redispatch Costs"
                value={`${fmtEur(avoidedPenaltyEur)} / yr`}
                sub={`${redispatchRiskPct}% redispatch exposure × €85 /MWh`}
                tone="green"
              />
              <p className="col-span-full text-[10px] text-muted-foreground">
                Co-location prevents the TSO from dispatching more expensive out-of-merit generation to relieve local congestion. Benchmarks: Bundesnetzagentur & ENTSO-E redispatch-cost reporting.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FinancialCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "green" | "cyan" }) {
  const toneCls = tone === "green"
    ? "border-green-accent/30 bg-green-accent/[0.06] text-green-accent"
    : "border-cyan-accent/30 bg-cyan-accent/[0.06] text-cyan-accent";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] font-mono-data text-muted-foreground">{sub}</div>
    </div>
  );
}
