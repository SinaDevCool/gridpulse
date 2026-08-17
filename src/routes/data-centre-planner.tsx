import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Activity,
  BarChart3,
  BatteryCharging,
  Building2,
  CircleDollarSign,
  Database,
  ExternalLink,
  Gauge,
  Leaf,
  ShieldAlert,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/product/AppShell";
import {
  calculateDataCentreDesign,
  type DataCentreDesignResult,
} from "@/features/data-centre-planner/model";
import {
  peerStatistic,
  selectPeers,
  type RzregPerformanceRecord,
} from "@/features/data-centre-planner/benchmark";
import {
  calculateFlexibilityEconomics,
  type FlexibilityEconomicsInput,
} from "@/features/data-centre-planner/flexibility-economics";

type Artifact = {
  metadata: { record_count: number; validation_warning_count: number };
  records: RzregPerformanceRecord[];
};
type View = "overview" | "energy" | "benchmark" | "flexibility" | "economics";
type Project = {
  name: string;
  location: string;
  it: number | null;
  pue: number | null;
  load: number | null;
  ref: number | null;
  erf: number | null;
  wue: number | null;
  firm: number | null;
  price: number | null;
};
const emptyProject: Project = {
  name: "",
  location: "",
  it: null,
  pue: null,
  load: null,
  ref: null,
  erf: null,
  wue: null,
  firm: null,
  price: null,
};
const emptyEconomics: FlexibilityEconomicsInput = {
  powerMw: null,
  durationHours: null,
  cyclesPerYear: null,
  roundTripEfficiencyPct: null,
  capexPowerEurPerKw: null,
  capexEnergyEurPerKwh: null,
  fixedOpexEurPerKwYear: null,
  variableOpexEurPerMwh: null,
  chargingEnergyPriceEurPerMwh: null,
  discountRatePct: null,
  economicLifeYears: null,
};
const TECHNOLOGIES = [
  {
    id: "li-ion",
    name: "Lithium-ion battery",
    duration: "Short to medium duration",
    maturity: "Commercial",
    site: "Modular; fire and safety design required",
    source: "US DOE storage assessment",
  },
  {
    id: "flow",
    name: "Vanadium flow battery",
    duration: "Multi-hour",
    maturity: "Commercial / scaling",
    site: "Larger footprint and electrolyte systems",
    source: "US DOE storage assessment",
  },
  {
    id: "caes",
    name: "Compressed-air storage",
    duration: "Long duration",
    maturity: "Site-dependent",
    site: "Suitable geology or engineered pressure vessels",
    source: "US DOE CAES assessment",
  },
  {
    id: "liquid-air",
    name: "Liquid-air storage",
    duration: "5 h in the cited UK project",
    maturity: "Demonstration / early commercial",
    site: "Industrial plant footprint and heat integration",
    source: "UK Government Storage at Scale",
  },
  {
    id: "co2",
    name: "CO₂ battery",
    duration: "10 h or longer in the cited project",
    maturity: "First-of-a-kind demonstration",
    site: "Large thermodynamic storage plant",
    source: "European Commission / EIB",
  },
  {
    id: "pumped-hydro",
    name: "Pumped-storage hydro",
    duration: "Long duration",
    maturity: "Mature",
    site: "Exceptional topography, water and permits",
    source: "US DOE storage assessment",
  },
  {
    id: "hydrogen",
    name: "Hydrogen storage",
    duration: "Long / seasonal potential",
    maturity: "Application-dependent",
    site: "Conversion losses, safety and infrastructure",
    source: "US DOE storage assessment",
  },
  {
    id: "thermal",
    name: "Thermal storage",
    duration: "Application-dependent",
    maturity: "Commercial in suitable heat/cooling uses",
    site: "Does not replace electrical UPS for all loads",
    source: "US DOE storage assessment",
  },
] as const;
type TechId = (typeof TECHNOLOGIES)[number]["id"];
const fmt = new Intl.NumberFormat("en-DE", { maximumFractionDigits: 1 });
const eur = new Intl.NumberFormat("en-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
export const Route = createFileRoute("/data-centre-planner")({ component: DataCentreAnalytics });

function DataCentreAnalytics() {
  const [view, setView] = useState<View>("overview"),
    [artifact, setArtifact] = useState<Artifact | null>(null),
    [project, setProject] = useState<Project>(emptyProject),
    [tech, setTech] = useState<TechId>("li-ion"),
    [cost, setCost] = useState(emptyEconomics),
    [drawer, setDrawer] = useState(false);
  useEffect(() => {
    fetch("/power-finder/rzreg-performance.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setArtifact)
      .catch(() => setArtifact(null));
  }, []);
  const design = useMemo(
    () =>
      Object.values({
        it: project.it,
        pue: project.pue,
        load: project.load,
        ref: project.ref,
        erf: project.erf,
        wue: project.wue,
      }).every((v) => v !== null)
        ? calculateDataCentreDesign({
            itLoadMw: project.it!,
            pue: project.pue!,
            loadFactorPct: project.load!,
            renewableEnergyFactorPct: project.ref!,
            energyReuseFactorPct: project.erf!,
            wueLitresPerKwhIt: project.wue!,
            wasteHeatTemperatureC: null,
          })
        : null,
    [project],
  );
  const peers = useMemo(
    () => (project.it === null ? [] : selectPeers(artifact?.records ?? [], project.it)),
    [artifact, project.it],
  );
  const flex = useMemo(() => calculateFlexibilityEconomics(cost), [cost]);
  const annualCost =
    design && project.price !== null ? design.annualFacilityEnergyGwh * 1000 * project.price : null;
  const gap =
    design && project.firm !== null ? Math.max(0, design.facilityPeakMw - project.firm) : null;
  const update = <K extends keyof Project>(key: K, value: Project[K]) =>
    setProject((p) => ({ ...p, [key]: value }));
  return (
    <AppShell>
      <main id="main-content" className="dca-shell">
        <header className="dca-header">
          <div>
            <span>Data Centre Analytics</span>
            <h1>{project.name || "Untitled Data Centre"}</h1>
            <p>{project.location || "Add a location to begin a traceable planning analysis."}</p>
          </div>
          <div className="dca-header-actions">
            <span className="dca-status">
              <ShieldAlert />
              Planning evidence only
            </span>
            <button type="button" onClick={() => setDrawer(true)}>
              <SlidersHorizontal />
              Inputs & assumptions
            </button>
          </div>
        </header>
        <nav className="dca-tabs" aria-label="Analytics views">
          {(
            [
              ["overview", "Overview", Building2],
              ["energy", "Energy", Zap],
              ["benchmark", "Benchmark", BarChart3],
              ["flexibility", "Flexibility economics", BatteryCharging],
              ["economics", "Economics", CircleDollarSign],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <section className="dca-canvas">
          {view === "overview" && (
            <Overview
              design={design}
              project={project}
              gap={gap}
              artifact={artifact}
              go={setView}
            />
          )}{" "}
          {view === "energy" && <Energy design={design} annualCost={annualCost} />}{" "}
          {view === "benchmark" && (
            <Benchmark project={project} peers={peers} artifact={artifact} />
          )}{" "}
          {view === "flexibility" && (
            <Flexibility
              tech={tech}
              setTech={setTech}
              cost={cost}
              setCost={setCost}
              result={flex}
              gap={gap}
            />
          )}{" "}
          {view === "economics" && (
            <Economics design={design} project={project} annualCost={annualCost} flex={flex} />
          )}
        </section>
        <footer className="dca-boundary">
          <ShieldAlert />
          <span>
            <strong>Decision boundary</strong> Public peer data and customer-entered scenarios do
            not establish available grid capacity. Only the responsible operator can confirm a
            connection envelope.
          </span>
          <small>Calculation v1.0</small>
        </footer>
      </main>
      {drawer && (
        <div
          className="dca-drawer-backdrop"
          role="presentation"
          onMouseDown={() => setDrawer(false)}
        >
          <aside
            className="dca-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="input-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span>Project evidence</span>
                <h2 id="input-title">Inputs & assumptions</h2>
              </div>
              <button type="button" aria-label="Close inputs" onClick={() => setDrawer(false)}>
                ×
              </button>
            </header>
            <p>
              Empty fields stay unavailable. Entered values are customer scenarios, not GridPulse
              estimates.
            </p>
            <TextField
              label="Project name"
              value={project.name}
              change={(v) => update("name", v)}
            />
            <TextField
              label="Location"
              value={project.location}
              change={(v) => update("location", v)}
            />
            <N
              label="Connected IT load"
              unit="MW"
              value={project.it}
              change={(v) => update("it", v)}
            />
            <N label="Planning PUE" value={project.pue} change={(v) => update("pue", v)} />
            <N
              label="IT load factor"
              unit="%"
              value={project.load}
              change={(v) => update("load", v)}
            />
            <N
              label="Renewable energy factor"
              unit="%"
              value={project.ref}
              change={(v) => update("ref", v)}
            />
            <N
              label="Energy reuse factor"
              unit="%"
              value={project.erf}
              change={(v) => update("erf", v)}
            />
            <N label="WUE" unit="L/kWh IT" value={project.wue} change={(v) => update("wue", v)} />
            <N
              label="Entered firm import offer"
              unit="MW"
              value={project.firm}
              change={(v) => update("firm", v)}
            />
            <N
              label="Electricity price"
              unit="€/MWh"
              value={project.price}
              change={(v) => update("price", v)}
            />
          </aside>
        </div>
      )}
    </AppShell>
  );
}
const Empty = ({ title, copy }: { title: string; copy: string }) => (
  <div className="dca-empty">
    <Database />
    <h2>{title}</h2>
    <p>{copy}</p>
    <small>Open Inputs & assumptions to continue.</small>
  </div>
);
const Metric = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <article className="dca-metric">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>
);
type Design = DataCentreDesignResult | null;
type FlexResult = NonNullable<ReturnType<typeof calculateFlexibilityEconomics>> | null;
function Overview({
  design,
  project,
  gap,
  artifact,
  go,
}: {
  design: Design;
  project: Project;
  gap: number | null;
  artifact: Artifact | null;
  go: Dispatch<SetStateAction<View>>;
}) {
  return (
    <>
      <Title
        over="Portfolio snapshot"
        title="What requires a decision?"
        copy="Demand, evidence, connection exposure and economic readiness in one concise view."
      />
      <div className="dca-metrics">
        <Metric
          label="Facility peak"
          value={design ? `${fmt.format(design.facilityPeakMw)} MW` : "Not calculated"}
          note="Requires IT load and PUE"
        />
        <Metric
          label="Annual energy"
          value={design ? `${fmt.format(design.annualFacilityEnergyGwh)} GWh` : "Not calculated"}
          note="Customer-input scenario"
        />
        <Metric
          label="Connection gap"
          value={gap === null ? "Unknown" : `${fmt.format(gap)} MW`}
          note="Against entered offer only"
        />
        <Metric
          label="Public peer evidence"
          value={artifact ? `${artifact.metadata.record_count} records` : "Unavailable"}
          note="RZReg; not site capacity"
        />
      </div>
      <div className="dca-grid-2">
        <article className="dca-card">
          <header>
            <Activity />
            <div>
              <span>Readiness path</span>
              <h3>Complete evidence before comparison</h3>
            </div>
          </header>
          {(
            [
              ["Energy design", !!design, "energy"],
              ["Peer benchmark", project.it !== null && !!artifact, "benchmark"],
              ["Operator envelope", project.firm !== null, "flexibility"],
              ["Commercial case", project.price !== null, "economics"],
            ] satisfies Array<[string, boolean, View]>
          ).map(([name, ok, target]) => (
            <button
              className="dca-ready"
              key={String(name)}
              type="button"
              onClick={() => go(target)}
            >
              <i className={ok ? "complete" : ""} />
              <span>
                <strong>{name}</strong>
                <small>{ok ? "Evidence present" : "Input required"}</small>
              </span>
              <b>→</b>
            </button>
          ))}
        </article>
        <article className="dca-card dca-callout">
          <ShieldAlert />
          <h3>Available MW remains unknown</h3>
          <p>
            This workspace tests demand and flexibility against an offer you enter. It does not
            infer DSO headroom, approval or an official connection point.
          </p>
        </article>
      </div>
    </>
  );
}
function Energy({ design, annualCost }: { design: Design; annualCost: number | null }) {
  if (!design)
    return (
      <Empty
        title="Define the energy design"
        copy="Add IT load, PUE, load factor, REF, ERF and WUE. No project values are prefilled."
      />
    );
  return (
    <>
      <Title
        over="Energy design"
        title="Demand, efficiency & resource exposure"
        copy="Calculated only from customer-entered project assumptions."
      />
      <div className="dca-grid-2">
        <article className="dca-card">
          <header>
            <Zap />
            <div>
              <span>Annual energy composition</span>
              <h3>{fmt.format(design.annualFacilityEnergyGwh)} GWh</h3>
            </div>
          </header>
          <div className="dca-stacked">
            <i
              style={{
                width: `${(design.annualItEnergyGwh / design.annualFacilityEnergyGwh) * 100}%`,
              }}
            />
            <i
              style={{
                width: `${(design.annualOverheadEnergyGwh / design.annualFacilityEnergyGwh) * 100}%`,
              }}
            />
          </div>
          <Line label="IT energy" value={`${fmt.format(design.annualItEnergyGwh)} GWh`} />
          <Line
            label="Facility overhead"
            value={`${fmt.format(design.annualOverheadEnergyGwh)} GWh`}
          />
        </article>
        <article className="dca-card">
          <header>
            <Gauge />
            <div>
              <span>Resource consequences</span>
              <h3>Operational design signals</h3>
            </div>
          </header>
          <div className="dca-kpi-list">
            <Line label="Peak facility import" value={`${fmt.format(design.facilityPeakMw)} MW`} />
            <Line
              label="Renewable target"
              value={`${fmt.format(design.annualRenewableEnergyGwh)} GWh/y`}
            />
            <Line
              label="Reusable heat scenario"
              value={`${fmt.format(design.annualReusableHeatGwh)} GWh/y`}
            />
            <Line label="Water scenario" value={`${fmt.format(design.annualWaterM3)} m³/y`} />
            <Line
              label="Electricity spend"
              value={annualCost === null ? "Add price" : eur.format(annualCost)}
            />
          </div>
        </article>
      </div>
    </>
  );
}
function Benchmark({
  project,
  peers,
  artifact,
}: {
  project: Project;
  peers: RzregPerformanceRecord[];
  artifact: Artifact | null;
}) {
  if (project.it === null)
    return (
      <Empty
        title="Choose a comparison scale"
        copy="Enter connected IT load to select a defensible RZReg peer cohort."
      />
    );
  const items = [
    ["PUE", project.pue, "pue", ""],
    ["Renewable factor", project.ref, "renewable_energy_factor_pct", "%"],
    ["Energy reuse", project.erf, "energy_reuse_factor_pct", "%"],
    ["WUE", project.wue, "wue_l_per_kwh_it", " L/kWh"],
  ] as const;
  return (
    <>
      <Title
        over="German public benchmark"
        title="How does the design compare?"
        copy={`${peers.length} records in the connected-IT-load cohort. Invalid fields are excluded metric by metric.`}
      />
      <div className="dca-benchmark-grid">
        {items.map(([label, value, key, unit]) => {
          const s = peerStatistic(peers, key),
            pos =
              value === null
                ? null
                : s.p75 === s.p25
                  ? 50
                  : Math.max(0, Math.min(100, ((value - s.p25) / (s.p75 - s.p25)) * 100));
          return (
            <article className="dca-card" key={label}>
              <span>{label}</span>
              <h3>{value === null ? "Project value missing" : `${value}${unit}`}</h3>
              <div className="dca-range">
                <span />
                <i style={pos === null ? { display: "none" } : { left: `${pos}%` }} />
              </div>
              <div className="dca-range-labels">
                <small>P25 {s.p25}</small>
                <small>Median {s.median}</small>
                <small>P75 {s.p75}</small>
              </div>
              <p>
                {s.count} valid · {peers.length - s.count} excluded/missing
              </p>
            </article>
          );
        })}
      </div>
      <div className="dca-source">
        <Database />
        <span>
          RZReg public artifact · {artifact?.metadata.record_count ?? 0} records ·{" "}
          {artifact?.metadata.validation_warning_count ?? 0} quarantined warnings
        </span>
      </div>
    </>
  );
}
function Flexibility({
  tech,
  setTech,
  cost,
  setCost,
  result,
  gap,
}: {
  tech: TechId;
  setTech: Dispatch<SetStateAction<TechId>>;
  cost: FlexibilityEconomicsInput;
  setCost: Dispatch<SetStateAction<FlexibilityEconomicsInput>>;
  result: FlexResult;
  gap: number | null;
}) {
  const chosen = TECHNOLOGIES.find((t) => t.id === tech)!;
  const set = (key: keyof FlexibilityEconomicsInput, value: number | null) =>
    setCost((c: FlexibilityEconomicsInput) => ({ ...c, [key]: value }));
  return (
    <>
      <Title
        over="Grid & flexibility"
        title="Compare flexibility technology economics"
        copy="Technical evidence describes suitability. Economics use only costs and operating assumptions you enter."
      />
      <div className="dca-flex-layout">
        <aside className="dca-tech-list">
          {TECHNOLOGIES.map((t) => (
            <button
              type="button"
              key={t.id}
              className={tech === t.id ? "active" : ""}
              onClick={() => setTech(t.id)}
            >
              <strong>{t.name}</strong>
              <small>{t.maturity}</small>
            </button>
          ))}
        </aside>
        <section className="dca-flex-main">
          <article className="dca-card dca-tech-summary">
            <header>
              <BatteryCharging />
              <div>
                <span>{chosen.maturity}</span>
                <h3>{chosen.name}</h3>
              </div>
            </header>
            <div>
              <Line label="Duration evidence" value={chosen.duration} />
              <Line label="Site constraint" value={chosen.site} />
              <Line label="Reference class" value={chosen.source} />
            </div>
          </article>
          <div className="dca-grid-2">
            <article className="dca-card">
              <header>
                <SlidersHorizontal />
                <div>
                  <span>Customer / supplier evidence</span>
                  <h3>Project economics inputs</h3>
                </div>
              </header>
              <div className="dca-form-grid">
                {(
                  [
                    ["Power", "MW", "powerMw"],
                    ["Duration", "h", "durationHours"],
                    ["Cycles per year", "", "cyclesPerYear"],
                    ["Round-trip efficiency", "%", "roundTripEfficiencyPct"],
                    ["Power CAPEX", "€/kW", "capexPowerEurPerKw"],
                    ["Energy CAPEX", "€/kWh", "capexEnergyEurPerKwh"],
                    ["Fixed OPEX", "€/kW-y", "fixedOpexEurPerKwYear"],
                    ["Variable OPEX", "€/MWh", "variableOpexEurPerMwh"],
                    ["Charging price", "€/MWh", "chargingEnergyPriceEurPerMwh"],
                    ["Discount rate", "%", "discountRatePct"],
                    ["Economic life", "years", "economicLifeYears"],
                  ] as const
                ).map(([label, unit, key]) => (
                  <N
                    key={key}
                    label={label}
                    unit={unit}
                    value={cost[key]}
                    change={(v) => set(key, v)}
                  />
                ))}
              </div>
            </article>
            <article className="dca-card dca-result-card">
              <header>
                <CircleDollarSign />
                <div>
                  <span>Comparable result</span>
                  <h3>{result ? `${eur.format(result.lcosEurPerMwh)}/MWh` : "Awaiting inputs"}</h3>
                </div>
              </header>
              {result ? (
                <div className="dca-kpi-list">
                  <Line label="Installed cost" value={eur.format(result.installedCostEur)} />
                  <Line label="Annualized CAPEX" value={eur.format(result.annualizedCapexEur)} />
                  <Line
                    label="Charging energy"
                    value={`${fmt.format(result.annualChargingMwh)} MWh/y`}
                  />
                  <Line label="Annual total cost" value={eur.format(result.annualCostEur)} />
                  <Line
                    label="Power gap coverage"
                    value={
                      gap === null
                        ? "Offer missing"
                        : gap === 0
                          ? "No entered gap"
                          : `${fmt.format(Math.min(100, (cost.powerMw! / gap) * 100))}%`
                    }
                  />
                  <p>
                    LCOS includes entered CAPEX, OPEX and charging losses. Revenues, taxes, grid
                    fees, replacement and residual value remain excluded.
                  </p>
                </div>
              ) : (
                <Empty
                  title="No economic result"
                  copy="Complete every cost, efficiency, use and finance input. GridPulse does not insert mock costs."
                />
              )}
            </article>
          </div>
        </section>
      </div>
      <Sources />
    </>
  );
}
function Economics({
  design,
  project,
  annualCost,
  flex,
}: {
  design: Design;
  project: Project;
  annualCost: number | null;
  flex: FlexResult;
}) {
  if (!design)
    return (
      <Empty
        title="Energy case not ready"
        copy="Complete Energy inputs before reviewing operating economics."
      />
    );
  return (
    <>
      <Title
        over="Project economics"
        title="Known exposure vs missing evidence"
        copy="No financial result appears until its required customer input exists."
      />
      <div className="dca-metrics">
        <Metric
          label="Annual electricity"
          value={`${fmt.format(design.annualFacilityEnergyGwh)} GWh`}
          note="Calculated demand"
        />
        <Metric
          label="Energy price"
          value={project.price === null ? "Missing" : `${eur.format(project.price)}/MWh`}
          note="Customer input"
        />
        <Metric
          label="Electricity spend"
          value={annualCost === null ? "Unavailable" : eur.format(annualCost)}
          note="Excludes taxes and grid charges"
        />
        <Metric
          label="Flexibility LCOS"
          value={flex ? `${eur.format(flex.lcosEurPerMwh)}/MWh` : "Unavailable"}
          note="Complete supplier inputs required"
        />
      </div>
      <article className="dca-card dca-callout">
        <Leaf />
        <h3>Investment decision unavailable</h3>
        <p>
          A defensible NPV needs contracted prices, tariffs, connection and construction costs,
          taxes, financing, revenues and chronological dispatch. RZReg cannot supply them.
        </p>
      </article>
    </>
  );
}
function Title({ over, title, copy }: { over: string; title: string; copy: string }) {
  return (
    <div className="dca-title">
      <span>{over}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="dca-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Sources() {
  return (
    <div className="dca-sources">
      <h3>Primary reference evidence</h3>
      <a
        href="https://www.energy.gov/cmei/2022-grid-energy-storage-technology-cost-and-performance-assessment"
        target="_blank"
        rel="noreferrer"
      >
        US DOE storage assessment <ExternalLink />
      </a>
      <a
        href="https://www.energy.gov/sites/default/files/2023-07/Technology%20Strategy%20Assessment%20-%20Compressed%20Air%20Energy%20Storage.pdf"
        target="_blank"
        rel="noreferrer"
      >
        US DOE compressed-air assessment <ExternalLink />
      </a>
      <a
        href="https://www.gov.uk/government/publications/storage-at-scale-competition-project-winner/storage-at-scale-project-winner-details"
        target="_blank"
        rel="noreferrer"
      >
        UK Government liquid-air project <ExternalLink />
      </a>
      <a
        href="https://cyprus.representation.ec.europa.eu/news/commission-european-investment-bank-and-breakthrough-energy-catalyst-partnership-funds-first-joint-2023-12-01_en"
        target="_blank"
        rel="noreferrer"
      >
        EC / EIB CO₂ Battery project <ExternalLink />
      </a>
    </div>
  );
}
function TextField({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
}) {
  const id = `text-${label.replaceAll(" ", "-")}`;
  return (
    <label className="dca-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        autoComplete="off"
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
}
function N({
  label,
  unit,
  value,
  change,
}: {
  label: string;
  unit?: string;
  value: number | null;
  change: (v: number | null) => void;
}) {
  const id = `num-${label.replaceAll(" ", "-")}`;
  return (
    <label className="dca-field" htmlFor={id}>
      <span>
        {label}
        <small>{unit}</small>
      </span>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        min="0"
        value={value ?? ""}
        onChange={(e) => change(e.target.value === "" ? null : Number(e.target.value))}
      />
    </label>
  );
}
