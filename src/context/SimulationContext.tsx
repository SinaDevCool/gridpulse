import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TSO_ZONES, sitingScore, type TsoCode, type TsoZone } from "@/lib/tso-zones";

// Global Simulation Context — binds the Co-Location Benefit Calculator drawer
// to the enterprise dashboard (map + European Load Siting Optimization Matrix)
// so slider inputs update Siting Scores, Time-to-Connect estimates, and map
// marker intensities in real time.

export interface SimulationState {
  requestedLoadMw: number;
  bessMw: number;
  bessMwh: number;
  selectedTsoZone: TsoCode;
}

// A saved scenario snapshot bundled onto the Active Siting Comparison Bench.
export interface SavedScenario extends SimulationState {
  id: string;
  label: string;
  savedAt: string; // ISO timestamp
  // Cached derived metrics so bench cards + CSV exports stay stable even if
  // the pricing / zone lookup tables change after the scenario is stored.
  bessRelief: number;
  congestionReliefPct: number;
  netGridDrawMw: number;
  peakShavedMw: number;
  baselineMonths: number;
  adjustedMonths: number;
  monthsSaved: number;
  sitingScore: number;
  avoidedPenaltyEurAnnual: number;
  avoidedGridUpgradeCapexEur: number;
  acceleratedRevenueEur: number;
  zoneName: string;
  country: string;
  // True when the scenario originated from the Autofind Optimal Siting engine.
  recommended: boolean;
}

// Region profile used by the Autofind Optimal Siting Nodes engine to weight
// TSO zones — "high-congestion" prioritises redispatch relief, "low-capex"
// prioritises fast-track / low-CapEx nodes, "balanced" is the default blend.
export type RegionProfile = "high-congestion" | "low-capex" | "balanced";

// --- Financial modelling constants -------------------------------------
// Bypassing an HV substation reinforcement is worth an industry-standard
// €200k per avoided MW of peak grid draw (transformer + protection + civils).
export const CAPEX_EUR_PER_AVOIDED_MW = 200_000;
// Every month clipped off the interconnection queue lets the hyperscaler
// bill contracted capacity earlier — €50k / MW / month at wholesale colo rates.
export const REVENUE_EUR_PER_MW_PER_MONTH = 50_000;

export function avoidedGridUpgradeCapex(loadMw: number, netGridDrawMw: number): number {
  return Math.max(0, Math.round((loadMw - netGridDrawMw) * CAPEX_EUR_PER_AVOIDED_MW));
}

export function acceleratedRevenue(loadMw: number, monthsSaved: number): number {
  return Math.max(0, Math.round(loadMw * monthsSaved * REVENUE_EUR_PER_MW_PER_MONTH));
}

export interface SimulationContextValue extends SimulationState {
  setRequestedLoadMw: (v: number) => void;
  setBessMw: (v: number) => void;
  setBessMwh: (v: number) => void;
  setSelectedTsoZone: (v: TsoCode) => void;
  // Derived, memoised for consumers.
  bessRelief: number; // 0..1 — fraction of load the BESS can shave
  fastTrackBoost: number; // 0..1 — visual scaling factor for fast-track pulses
  congestionRelief: number; // 0..1 — visual dampening factor for congested markers
  // Multi-scenario bench state.
  savedScenarios: SavedScenario[];
  saveScenario: (customLabel?: string) => void;
  removeScenario: (id: string) => void;
  clearScenarios: () => void;
}

const DEFAULTS: SimulationState = {
  requestedLoadMw: 50,
  bessMw: 20,
  bessMwh: 40,
  selectedTsoZone: TSO_ZONES[0].code,
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

// -------------------------------------------------------------------
// Deterministic "Avoided TSO Congestion Penalties" model.
// Translates redispatch exposure into an annual euro projection:
//   annual €  =  loadMW  ×  redispatchRisk%  ×  8,760 h  ×  €/MWh curtailment
//                × relief fraction earned by the on-site BESS
// The €/MWh factor is the sector-standard shorthand used in ENTSO-E and
// Bundesnetzagentur redispatch-cost reporting for congestion redispatch.
// -------------------------------------------------------------------
const CURTAILMENT_EUR_PER_MWH = 85;

export function avoidedPenaltyEurAnnual(
  zone: TsoZone,
  loadMw: number,
  reliefFraction: number,
): number {
  const exposedMwh = loadMw * (zone.redispatchRiskPct / 100) * 8760;
  return Math.round(exposedMwh * CURTAILMENT_EUR_PER_MWH * reliefFraction);
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [requestedLoadMw, setRequestedLoadMw] = useState<number>(DEFAULTS.requestedLoadMw);
  const [bessMw, setBessMw] = useState<number>(DEFAULTS.bessMw);
  const [bessMwh, setBessMwh] = useState<number>(DEFAULTS.bessMwh);
  const [selectedTsoZone, setSelectedTsoZone] = useState<TsoCode>(DEFAULTS.selectedTsoZone);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);

  const derived = useMemo(() => {
    // Deterministic scaling physics — see docstring on `SimulationContextValue`.
    const shaved = Math.min(bessMw, requestedLoadMw * 0.6);
    const bessRelief = requestedLoadMw > 0 ? shaved / requestedLoadMw : 0;
    const fastTrackBoost = Math.min(1, bessMw / 200);
    const congestionRelief = Math.min(1, bessMw / 250);
    return { shaved, bessRelief, fastTrackBoost, congestionRelief };
  }, [requestedLoadMw, bessMw]);

  const saveScenario = useCallback(
    (customLabel?: string) => {
      const zone =
        TSO_ZONES.find((z) => z.code === selectedTsoZone) ?? TSO_ZONES[0];
      const shaved = Math.min(bessMw, requestedLoadMw * 0.6);
      const netGridDrawMw = Math.max(requestedLoadMw - shaved, 0);
      const bessRelief = requestedLoadMw > 0 ? shaved / requestedLoadMw : 0;
      const congestionReliefPct = Math.min(bessRelief * 100, 100);
      const baselineMonths = zone.timeToEnergizeMonths;
      const adjustedMonths = Math.max(
        6,
        Math.round(baselineMonths - (congestionReliefPct / 10) * 9),
      );
      const monthsSaved = Math.max(baselineMonths - adjustedMonths, 0);
      const baseScore = sitingScore(zone);
      const scoreLift = Math.round(bessRelief * 12);
      const score = Math.min(100, baseScore + scoreLift);
      const now = new Date();
      const seq = savedScenarios.length + 1;
      const letter = String.fromCharCode(65 + ((seq - 1) % 26));
      const label = (customLabel && customLabel.trim())
        || `Scenario ${letter}: ${zone.name} Cluster`;
      const scenario: SavedScenario = {
        id: `scn_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        label,
        savedAt: now.toISOString(),
        requestedLoadMw,
        bessMw,
        bessMwh,
        selectedTsoZone,
        bessRelief,
        congestionReliefPct,
        netGridDrawMw,
        peakShavedMw: shaved,
        baselineMonths,
        adjustedMonths,
        monthsSaved,
        sitingScore: score,
        avoidedPenaltyEurAnnual: avoidedPenaltyEurAnnual(zone, requestedLoadMw, bessRelief),
        avoidedGridUpgradeCapexEur: avoidedGridUpgradeCapex(requestedLoadMw, netGridDrawMw),
        acceleratedRevenueEur: acceleratedRevenue(requestedLoadMw, monthsSaved),
        zoneName: zone.name,
        country: zone.country,
      };
      setSavedScenarios((prev) => [...prev, scenario]);
    },
    [requestedLoadMw, bessMw, bessMwh, selectedTsoZone, savedScenarios.length],
  );

  const removeScenario = useCallback((id: string) => {
    setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearScenarios = useCallback(() => setSavedScenarios([]), []);

  const value = useMemo<SimulationContextValue>(
    () => ({
      requestedLoadMw,
      bessMw,
      bessMwh,
      selectedTsoZone,
      setRequestedLoadMw,
      setBessMw,
      setBessMwh,
      setSelectedTsoZone,
      bessRelief: derived.bessRelief,
      fastTrackBoost: derived.fastTrackBoost,
      congestionRelief: derived.congestionRelief,
      savedScenarios,
      saveScenario,
      removeScenario,
      clearScenarios,
    }),
    [requestedLoadMw, bessMw, bessMwh, selectedTsoZone, derived, savedScenarios, saveScenario, removeScenario, clearScenarios],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useSimulation must be used within <SimulationProvider>");
  }
  return ctx;
}
