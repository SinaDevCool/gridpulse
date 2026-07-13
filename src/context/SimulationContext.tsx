import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { TSO_ZONES, type TsoCode } from "@/lib/tso-zones";

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

export interface SimulationContextValue extends SimulationState {
  setRequestedLoadMw: (v: number) => void;
  setBessMw: (v: number) => void;
  setBessMwh: (v: number) => void;
  setSelectedTsoZone: (v: TsoCode) => void;
  // Derived, memoised for consumers.
  bessRelief: number; // 0..1 — fraction of load the BESS can shave
  fastTrackBoost: number; // 0..1 — visual scaling factor for fast-track pulses
  congestionRelief: number; // 0..1 — visual dampening factor for congested markers
}

const DEFAULTS: SimulationState = {
  requestedLoadMw: 50,
  bessMw: 20,
  bessMwh: 40,
  selectedTsoZone: TSO_ZONES[0].code,
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [requestedLoadMw, setRequestedLoadMw] = useState<number>(DEFAULTS.requestedLoadMw);
  const [bessMw, setBessMw] = useState<number>(DEFAULTS.bessMw);
  const [bessMwh, setBessMwh] = useState<number>(DEFAULTS.bessMwh);
  const [selectedTsoZone, setSelectedTsoZone] = useState<TsoCode>(DEFAULTS.selectedTsoZone);

  const value = useMemo<SimulationContextValue>(() => {
    // -------------------------------------------------------------------
    // Deterministic scaling physics for the Projects map pulse rings.
    //
    // `bessRelief` (0..1): fraction of the requested industrial load that
    //   the on-site BESS can shave off the grid draw. We cap the useful
    //   shave at 60% of load — beyond that the battery is oversized for
    //   the peak profile and yields diminishing returns.
    //
    // `fastTrackBoost` (0..1): drives the *green* fast-track pulse. Scales
    //   linearly with BESS MW up to a 200 MW reference asset — matching
    //   the typical hyperscale co-location tier at which TSOs waive
    //   reinforcement studies. Above 200 MW the visual is saturated.
    //
    // `congestionRelief` (0..1): dampens the *red* congestion glow on
    //   congested nodes. Uses a slightly larger 250 MW denominator so a
    //   battery that fully saturates fast-track visuals still shows some
    //   residual red — congestion never fully disappears, only eases.
    // -------------------------------------------------------------------
    const shaved = Math.min(bessMw, requestedLoadMw * 0.6);
    const bessRelief = requestedLoadMw > 0 ? shaved / requestedLoadMw : 0;
    const fastTrackBoost = Math.min(1, bessMw / 200);
    const congestionRelief = Math.min(1, bessMw / 250);
    return {
      requestedLoadMw,
      bessMw,
      bessMwh,
      selectedTsoZone,
      setRequestedLoadMw,
      setBessMw,
      setBessMwh,
      setSelectedTsoZone,
      bessRelief,
      fastTrackBoost,
      congestionRelief,
    };
  }, [requestedLoadMw, bessMw, bessMwh, selectedTsoZone]);

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useSimulation must be used within <SimulationProvider>");
  }
  return ctx;
}
