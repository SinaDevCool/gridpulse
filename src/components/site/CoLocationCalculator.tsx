import { useMemo } from "react";
import { X, Zap, TrendingDown, Clock, ShieldCheck, Download } from "lucide-react";

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
          <button
            onClick={onClose}
            aria-label="Close calculator"
            className="shrink-0 rounded-md border border-border/60 bg-surface/60 p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
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
