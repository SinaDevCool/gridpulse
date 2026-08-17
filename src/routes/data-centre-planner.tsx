import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  BarChart3,
  BatteryCharging,
  Building2,
  Flame,
  Leaf,
  ShieldAlert,
  Waves,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/product/AppShell";
import { calculateDataCentreDesign } from "@/features/data-centre-planner/model";
import {
  peerStatistic,
  selectPeers,
  type RzregPerformanceRecord,
} from "@/features/data-centre-planner/benchmark";

type Artifact = {
  metadata: {
    record_count: number;
    validation_warning_count: number;
    truth_class: string;
    prohibited_use: string;
  };
  records: RzregPerformanceRecord[];
};

export const Route = createFileRoute("/data-centre-planner")({ component: DataCentrePlannerPage });

function numeric(event: ChangeEvent<HTMLInputElement>) {
  return Number(event.target.value) || 0;
}

function DataCentrePlannerPage() {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [itLoadMw, setItLoadMw] = useState(25);
  const [pue, setPue] = useState(1.35);
  const [loadFactorPct, setLoadFactorPct] = useState(90);
  const [ref, setRef] = useState(100);
  const [erf, setErf] = useState(10);
  const [wue, setWue] = useState(0.2);
  const [minimumFirmMw, setMinimumFirmMw] = useState(20);
  const [shiftableMw, setShiftableMw] = useState(5);
  const [batteryPowerMw, setBatteryPowerMw] = useState(0);
  const [batteryEnergyMwh, setBatteryEnergyMwh] = useState(0);

  useEffect(() => {
    fetch("/power-finder/rzreg-performance.json")
      .then((response) => {
        if (!response.ok) throw new Error("RZReg performance artifact unavailable");
        return response.json() as Promise<Artifact>;
      })
      .then(setArtifact)
      .catch(() => setArtifact(null));
  }, []);

  const design = useMemo(
    () =>
      calculateDataCentreDesign({
        itLoadMw,
        pue,
        loadFactorPct,
        renewableEnergyFactorPct: ref,
        energyReuseFactorPct: erf,
        wueLitresPerKwhIt: wue,
        wasteHeatTemperatureC: null,
      }),
    [itLoadMw, pue, loadFactorPct, ref, erf, wue],
  );
  const peers = useMemo(() => selectPeers(artifact?.records ?? [], itLoadMw), [artifact, itLoadMw]);
  const puePeers = useMemo(() => peerStatistic(peers, "pue"), [peers]);
  const refPeers = useMemo(() => peerStatistic(peers, "renewable_energy_factor_pct"), [peers]);
  const erfPeers = useMemo(() => peerStatistic(peers, "energy_reuse_factor_pct"), [peers]);
  const wuePeers = useMemo(() => peerStatistic(peers, "wue_l_per_kwh_it"), [peers]);
  const requestedImportMw = design.facilityPeakMw;
  const flexibleEnvelopeMw = Math.min(
    requestedImportMw,
    minimumFirmMw + shiftableMw + batteryPowerMw,
  );
  const batteryDuration = batteryPowerMw > 0 ? batteryEnergyMwh / batteryPowerMw : 0;

  return (
    <AppShell>
      <main id="main-content" className="dc-planner">
        <header className="dc-planner-hero">
          <div>
            <span>Data Centre Planner</span>
            <h1>Turn IT requirements into an evidence-aware energy and grid brief.</h1>
            <p>
              Model facility demand, compare reported German peers, and test customer-defined
              connection envelopes. Grid capacity remains unknown until the responsible operator
              confirms it.
            </p>
          </div>
          <div className="dc-truth-card">
            <ShieldAlert />
            <strong>Planning evidence only</strong>
            <p>
              RZReg values describe reported facilities. They do not establish capacity at the
              proposed site.
            </p>
          </div>
        </header>

        <div className="dc-planner-layout">
          <aside className="dc-input-panel">
            <h2>Design inputs</h2>
            <label>
              Connected IT load <span>{itLoadMw} MW</span>
              <input
                type="range"
                min="1"
                max="200"
                step="1"
                value={itLoadMw}
                onChange={(e) => setItLoadMw(numeric(e))}
              />
            </label>
            <label>
              Planning PUE{" "}
              <input
                type="number"
                min="1"
                max="3"
                step="0.01"
                value={pue}
                onChange={(e) => setPue(numeric(e))}
              />
            </label>
            <label>
              IT load factor <span>{loadFactorPct}%</span>
              <input
                type="range"
                min="20"
                max="100"
                value={loadFactorPct}
                onChange={(e) => setLoadFactorPct(numeric(e))}
              />
            </label>
            <label>
              Renewable energy factor <span>{ref}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={ref}
                onChange={(e) => setRef(numeric(e))}
              />
            </label>
            <label>
              Energy reuse factor <span>{erf}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={erf}
                onChange={(e) => setErf(numeric(e))}
              />
            </label>
            <label>
              Water usage effectiveness{" "}
              <input
                type="number"
                min="0"
                max="20"
                step="0.05"
                value={wue}
                onChange={(e) => setWue(numeric(e))}
              />
            </label>
            <hr />
            <h2>Hypothetical operator offer</h2>
            <p className="dc-input-note">
              These are customer-entered scenarios, not GridPulse capacity estimates.
            </p>
            <label>
              Firm import (MW)
              <input
                type="number"
                min="0"
                value={minimumFirmMw}
                onChange={(e) => setMinimumFirmMw(numeric(e))}
              />
            </label>
            <label>
              Shiftable workload (MW)
              <input
                type="number"
                min="0"
                value={shiftableMw}
                onChange={(e) => setShiftableMw(numeric(e))}
              />
            </label>
            <label>
              Battery power (MW)
              <input
                type="number"
                min="0"
                value={batteryPowerMw}
                onChange={(e) => setBatteryPowerMw(numeric(e))}
              />
            </label>
            <label>
              Battery energy (MWh)
              <input
                type="number"
                min="0"
                value={batteryEnergyMwh}
                onChange={(e) => setBatteryEnergyMwh(numeric(e))}
              />
            </label>
          </aside>

          <section className="dc-results">
            <div className="dc-section-heading">
              <Building2 />
              <div>
                <span>01 · Energy design</span>
                <h2>Facility power and annual demand</h2>
              </div>
            </div>
            <div className="dc-metric-grid">
              <article>
                <Zap />
                <span>Peak facility demand</span>
                <strong>{design.facilityPeakMw.toLocaleString()} MW</strong>
                <small>IT load × planning PUE</small>
              </article>
              <article>
                <BarChart3 />
                <span>Annual facility energy</span>
                <strong>{design.annualFacilityEnergyGwh.toLocaleString()} GWh</strong>
                <small>{design.averageFacilityMw} MW average</small>
              </article>
              <article>
                <Leaf />
                <span>Renewable requirement</span>
                <strong>{design.annualRenewableEnergyGwh.toLocaleString()} GWh</strong>
                <small>{ref}% declared target</small>
              </article>
              <article>
                <Flame />
                <span>Reusable heat potential</span>
                <strong>{design.annualReusableHeatGwh.toLocaleString()} GWh</strong>
                <small>Scenario based on declared ERF</small>
              </article>
              <article>
                <Waves />
                <span>Annual water scenario</span>
                <strong>{design.annualWaterM3.toLocaleString()} m³</strong>
                <small>Derived from IT energy and WUE</small>
              </article>
            </div>

            <div className="dc-section-heading">
              <BarChart3 />
              <div>
                <span>02 · RZReg benchmark</span>
                <h2>Comparable reported facilities</h2>
              </div>
            </div>
            <p className="dc-section-copy">
              {peers.length} records in the current connected-IT-load cohort. Out-of-range fields
              are excluded metric by metric; zeros remain reported zeros and are not silently
              converted to missing values.
            </p>
            <div className="dc-benchmark-grid">
              {[
                { label: "PUE", value: pue, unit: "", stats: puePeers },
                { label: "Renewable factor", value: ref, unit: "%", stats: refPeers },
                { label: "Energy reuse factor", value: erf, unit: "%", stats: erfPeers },
                { label: "WUE", value: wue, unit: " L/kWh IT", stats: wuePeers },
              ].map((item) => (
                <article key={item.label}>
                  <header>
                    <span>{item.label}</span>
                    <strong>
                      {item.value}
                      {item.unit}
                    </strong>
                  </header>
                  <div className="dc-percentile">
                    <i
                      style={{
                        left: `${Math.max(0, Math.min(100, item.stats.p75 === item.stats.p25 ? 50 : ((item.value - item.stats.p25) / (item.stats.p75 - item.stats.p25)) * 100))}%`,
                      }}
                    />
                    <span />
                  </div>
                  <footer>
                    <small>P25 {item.stats.p25}</small>
                    <small>Median {item.stats.median}</small>
                    <small>P75 {item.stats.p75}</small>
                  </footer>
                  <em>{item.stats.count} valid reports</em>
                </article>
              ))}
            </div>

            <div className="dc-section-heading">
              <BatteryCharging />
              <div>
                <span>03 · Connection strategy</span>
                <h2>Grid-only and flexible-envelope comparison</h2>
              </div>
            </div>
            <div className="dc-option-grid">
              <article>
                <span>Grid-only hypothesis</span>
                <strong>{Math.min(requestedImportMw, minimumFirmMw).toFixed(1)} MW</strong>
                <p>
                  {minimumFirmMw >= requestedImportMw
                    ? "Entered firm offer covers the planning peak."
                    : `${(requestedImportMw - minimumFirmMw).toFixed(1)} MW remains above the entered firm offer.`}
                </p>
              </article>
              <article>
                <span>Flexible-envelope hypothesis</span>
                <strong>{flexibleEnvelopeMw.toFixed(1)} MW</strong>
                <p>
                  Combines the entered firm offer, shiftable workload and battery power without
                  creating network capacity.
                </p>
              </article>
              <article>
                <span>Battery duration</span>
                <strong>{batteryDuration.toFixed(1)} h</strong>
                <p>
                  Usable duration before efficiency, reserve, rebound and chronological dispatch
                  validation.
                </p>
              </article>
            </div>

            <section className="dc-boundary">
              <ShieldAlert />
              <div>
                <strong>Decision boundary</strong>
                <p>
                  The planner sizes demand and flexibility and compares public peer context. It
                  cannot state available MW, select an official connection point, or replace an
                  operator study.
                </p>
                <small>
                  {artifact
                    ? `${artifact.metadata.record_count} RZReg records · ${artifact.metadata.validation_warning_count} quarantined field warnings`
                    : "RZReg benchmark unavailable"}
                </small>
              </div>
            </section>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
