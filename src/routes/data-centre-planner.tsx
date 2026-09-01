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
  validMetricValues,
  type RzregPerformanceRecord,
} from "@/features/data-centre-planner/benchmark";
import {
  calculateStorageLcos,
  type StorageLcosInput,
} from "@/features/data-centre-planner/storage-lcos";
import {
  BarComparison,
  EvidenceLegend,
  SensitivityMatrix,
  WaterfallChart,
} from "@/features/data-centre-planner/analytics-charts";
import { CanonicalPlanningWorkbench } from "@/features/analytics/CanonicalPlanningWorkbench";

type Artifact = {
  metadata: { record_count: number; validation_warning_count: number };
  records: RzregPerformanceRecord[];
};
type View = "overview" | "energy" | "benchmark" | "flexibility" | "economics" | "canonical";
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
const emptyEconomics: StorageLcosInput = {
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
type TechnologyScenario = {
  inputs: StorageLcosInput;
  evidenceType: "customer_assumption" | "supplier_quote" | "published_reference";
  sourceReference: string;
  priceYear: number | null;
};
type TechnologyScenarios = Record<TechId, TechnologyScenario>;
const emptyScenarios = Object.fromEntries(
  TECHNOLOGIES.map((technology) => [
    technology.id,
    {
      inputs: { ...emptyEconomics },
      evidenceType: "customer_assumption",
      sourceReference: "",
      priceYear: null,
    },
  ]),
) as TechnologyScenarios;
const STORAGE_KEY = "gridpulse:data-centre-analytics:v2";
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
    [scenarios, setScenarios] = useState<TechnologyScenarios>(emptyScenarios),
    [persistenceReady, setPersistenceReady] = useState(false),
    [drawer, setDrawer] = useState(false);
  useEffect(() => {
    fetch("/power-finder/rzreg-performance.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setArtifact)
      .catch(() => setArtifact(null));
  }, []);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          project?: Project;
          scenarios?: TechnologyScenarios;
          view?: View;
        };
        if (parsed.project) setProject(parsed.project);
        if (parsed.scenarios) setScenarios({ ...emptyScenarios, ...parsed.scenarios });
        if (parsed.view) setView(parsed.view);
      }
      const requestedView = new URL(window.location.href).searchParams.get("view");
      if (
        ["overview", "energy", "benchmark", "flexibility", "economics", "canonical"].includes(
          requestedView ?? "",
        )
      )
        setView(requestedView as View);
    } catch {
      // Corrupt browser state fails closed to empty inputs.
    } finally {
      setPersistenceReady(true);
    }
  }, []);
  useEffect(() => {
    if (!persistenceReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ project, scenarios, view }));
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
  }, [persistenceReady, project, scenarios, view]);
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
  const results = useMemo(
    () =>
      Object.fromEntries(
        TECHNOLOGIES.map((technology) => [
          technology.id,
          calculateStorageLcos(scenarios[technology.id].inputs),
        ]),
      ) as Record<TechId, FlexResult>,
    [scenarios],
  );
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
              ["canonical", "Canonical runs", Activity],
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
              scenarios={scenarios}
              setScenarios={setScenarios}
              results={results}
              gap={gap}
              design={design}
            />
          )}{" "}
          {view === "economics" && (
            <Economics
              design={design}
              project={project}
              annualCost={annualCost}
              results={results}
            />
          )}
          {view === "canonical" && <CanonicalPlanningWorkbench />}
        </section>
        <footer className="dca-boundary">
          <ShieldAlert />
          <span>
            <strong>Decision boundary</strong> Public peer data and customer-entered scenarios do
            not establish available grid capacity. Only the responsible operator can confirm a
            connection envelope.
          </span>
          <small>Calculation v2.0</small>
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
type FlexResult = NonNullable<ReturnType<typeof calculateStorageLcos>> | null;
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
      <EvidenceLegend />
      <article className="dca-card dca-primary-chart">
        <WaterfallChart
          title="Project demand and entered connection envelope"
          unit="MW"
          items={[
            { label: "Connected IT", value: project.it, color: "#49d3ff", note: "Customer input" },
            {
              label: "Facility peak",
              value: design?.facilityPeakMw ?? null,
              color: "#8b75ff",
              note: "Calculated with PUE",
            },
            {
              label: "Entered firm offer",
              value: project.firm,
              color: "#54d6a6",
              note: "Customer/operator scenario",
            },
            {
              label: "Unresolved gap",
              value: gap,
              color: "#efb743",
              note: "Not available capacity",
            },
          ]}
        />
      </article>
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
      <DecisionNote
        title={
          gap === null
            ? "Connection exposure cannot be evaluated"
            : gap > 0
              ? `${fmt.format(gap)} MW remains above the entered offer`
              : "Entered offer covers the calculated planning peak"
        }
        copy={
          gap === null
            ? "Enter a documented or hypothetical firm-import envelope. The result will remain a scenario until operator confirmation."
            : gap > 0
              ? "Compare time-limited flexibility options, then obtain an hourly operator envelope. Instantaneous power coverage alone is insufficient."
              : "Confirm the offer, operating restrictions, N-1 basis and delivery date with the responsible operator."
        }
      />
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
          <WaterfallChart
            title="Annual facility energy"
            unit="GWh"
            items={[
              {
                label: "IT energy",
                value: design.annualItEnergyGwh,
                color: "#49d3ff",
                note: "IT load × load factor",
              },
              {
                label: "PUE overhead",
                value: design.annualOverheadEnergyGwh,
                color: "#8b75ff",
                note: "Cooling and electrical overhead",
              },
              {
                label: "Facility total",
                value: design.annualFacilityEnergyGwh,
                color: "#54d6a6",
                note: "Calculated annual demand",
              },
            ]}
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
      <article className="dca-card dca-wide-chart">
        <BarComparison
          title="Annual resource exposure"
          unit="GWh"
          items={[
            { label: "Facility energy", value: design.annualFacilityEnergyGwh, color: "#49d3ff" },
            { label: "Renewable target", value: design.annualRenewableEnergyGwh, color: "#54d6a6" },
            {
              label: "Reusable heat scenario",
              value: design.annualReusableHeatGwh,
              color: "#efb743",
            },
          ]}
        />
      </article>
      <DecisionNote
        title="Efficiency is a first-order commercial lever"
        copy="Use an interval load profile next. Without real hourly demand, the workspace will not manufacture monthly or hourly operating charts."
      />
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
  const percentileItems = items.map(([label, value, key]) => {
    const values = validMetricValues(peers, key).sort((a, b) => a - b);
    const percentile =
      value === null || values.length === 0
        ? null
        : (values.filter((candidate) => candidate <= value).length / values.length) * 100;
    return { label, value: percentile, color: "#8b75ff", note: "Rank within valid cohort" };
  });
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
      <div className="dca-grid-2 dca-section-gap">
        <article className="dca-card">
          <BarComparison
            title="Project percentile within selected cohort"
            unit="percentile"
            items={percentileItems}
          />
        </article>
        <article className="dca-card dca-callout">
          <BarChart3 />
          <h3>Benchmark interpretation</h3>
          <p>
            Renewable-factor results clustered at 100% provide little differentiation. PUE and WUE
            provide more useful design context; ERF highlights a potential heat-reuse opportunity
            but not technical feasibility.
          </p>
        </article>
      </div>
      <DecisionNote
        title="Use peer data as context, not a site forecast"
        copy="RZReg describes reporting facilities. It does not establish Berlin grid capacity, local energy prices or the operating performance of the proposed facility."
      />
    </>
  );
}
function Flexibility({
  tech,
  setTech,
  scenarios,
  setScenarios,
  results,
  gap,
  design,
}: {
  tech: TechId;
  setTech: Dispatch<SetStateAction<TechId>>;
  scenarios: TechnologyScenarios;
  setScenarios: Dispatch<SetStateAction<TechnologyScenarios>>;
  results: Record<TechId, FlexResult>;
  gap: number | null;
  design: Design;
}) {
  const chosen = TECHNOLOGIES.find((t) => t.id === tech)!;
  const scenario = scenarios[tech];
  const cost = scenario.inputs;
  const result = results[tech];
  const set = (key: keyof StorageLcosInput, value: number | null) =>
    setScenarios((current) => ({
      ...current,
      [tech]: { ...current[tech], inputs: { ...current[tech].inputs, [key]: value } },
    }));
  const updateEvidence = (patch: Partial<TechnologyScenario>) =>
    setScenarios((current) => ({ ...current, [tech]: { ...current[tech], ...patch } }));
  const comparable = TECHNOLOGIES.map((technology) => ({
    technology,
    scenario: scenarios[technology.id],
    result: results[technology.id],
  }));
  return (
    <>
      <Title
        over="Grid & flexibility"
        title="Compare flexibility technology economics"
        copy="Technical evidence describes suitability. Economics use only costs and operating assumptions you enter."
      />
      <EvidenceLegend />
      <article className="dca-card dca-primary-chart">
        <WaterfallChart
          title="Peak connection-gap coverage"
          unit="MW"
          items={[
            {
              label: "Facility peak",
              value: design?.facilityPeakMw ?? null,
              color: "#8b75ff",
              note: "Calculated demand",
            },
            {
              label: "Entered firm offer",
              value: design && gap !== null ? design.facilityPeakMw - gap : null,
              color: "#54d6a6",
              note: "Entered scenario",
            },
            { label: "Peak gap", value: gap, color: "#efb743", note: "Not available capacity" },
            {
              label: `${chosen.name} power`,
              value: cost.powerMw,
              color: "#49d3ff",
              note: "Customer / supplier input",
            },
            {
              label: "Residual instantaneous gap",
              value: gap === null || cost.powerMw === null ? null : Math.max(0, gap - cost.powerMw),
              color: "#f27a8a",
              note: "Chronology not validated",
            },
          ]}
        />
      </article>
      <div className="dca-grid-2 dca-section-gap">
        <article className="dca-card">
          <BarComparison
            title="Installed-cost comparison"
            unit="M€"
            items={comparable.map(({ technology, result }) => ({
              label: technology.name,
              value: result ? result.installedCostEur / 1_000_000 : null,
              color: technology.id === tech ? "#49d3ff" : "#8b75ff",
              note: result ? "Complete entered scenario" : "Missing inputs",
            }))}
          />
        </article>
        <article className="dca-card">
          <BarComparison
            title="Levelized cost of storage"
            unit="€/MWh"
            items={comparable.map(({ technology, result }) => ({
              label: technology.name,
              value: result?.lcosEurPerMwh ?? null,
              color: technology.id === tech ? "#49d3ff" : "#54d6a6",
              note: result ? "Calculated from entered costs" : "Not comparable",
            }))}
          />
        </article>
      </div>
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
              <small>{results[t.id] ? "Comparable · entered evidence" : t.maturity}</small>
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
                <label className="dca-field" htmlFor="flex-evidence-type">
                  <span>Evidence type</span>
                  <select
                    id="flex-evidence-type"
                    name="flex-evidence-type"
                    value={scenario.evidenceType}
                    onChange={(event) =>
                      updateEvidence({
                        evidenceType: event.target.value as TechnologyScenario["evidenceType"],
                      })
                    }
                  >
                    <option value="customer_assumption">Customer assumption</option>
                    <option value="supplier_quote">Supplier quotation</option>
                    <option value="published_reference">Published reference</option>
                  </select>
                </label>
                <TextField
                  label="Source or quotation reference"
                  value={scenario.sourceReference}
                  change={(sourceReference) => updateEvidence({ sourceReference })}
                />
                <N
                  label="Price year"
                  value={scenario.priceYear}
                  change={(priceYear) => updateEvidence({ priceYear })}
                />
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
      <article className="dca-card dca-comparison-table">
        <header>
          <BarChart3 />
          <div>
            <span>Comparable scenarios</span>
            <h3>Technology decision table</h3>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Technology</th>
              <th scope="col">Power</th>
              <th scope="col">Duration</th>
              <th scope="col">Efficiency</th>
              <th scope="col">Installed cost</th>
              <th scope="col">LCOS</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {comparable.map(({ technology, scenario: entry, result: entryResult }) => (
              <tr key={technology.id}>
                <th scope="row">{technology.name}</th>
                <td>
                  {entry.inputs.powerMw === null
                    ? "Missing"
                    : `${fmt.format(entry.inputs.powerMw)} MW`}
                </td>
                <td>
                  {entry.inputs.durationHours === null
                    ? "Missing"
                    : `${fmt.format(entry.inputs.durationHours)} h`}
                </td>
                <td>
                  {entry.inputs.roundTripEfficiencyPct === null
                    ? "Missing"
                    : `${fmt.format(entry.inputs.roundTripEfficiencyPct)}%`}
                </td>
                <td>{entryResult ? eur.format(entryResult.installedCostEur) : "Not comparable"}</td>
                <td>
                  {entryResult ? `${eur.format(entryResult.lcosEurPerMwh)}/MWh` : "Not comparable"}
                </td>
                <td>{entry.evidenceType.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <DecisionNote
        title="Instantaneous coverage is not chronological feasibility"
        copy="Upload a real interval demand profile and obtain a time-varying operator envelope before assessing constrained hours, state of charge, recharge, rebound or service continuity."
      />
      <Sources />
    </>
  );
}
function Economics({
  design,
  project,
  annualCost,
  results,
}: {
  design: Design;
  project: Project;
  annualCost: number | null;
  results: Record<TechId, FlexResult>;
}) {
  if (!design)
    return (
      <Empty
        title="Energy case not ready"
        copy="Complete Energy inputs before reviewing operating economics."
      />
    );
  const completed = TECHNOLOGIES.map((technology) => ({
    technology,
    result: results[technology.id],
  })).filter(
    (
      entry,
    ): entry is { technology: (typeof TECHNOLOGIES)[number]; result: NonNullable<FlexResult> } =>
      entry.result !== null,
  );
  const lowestLcos = completed.length
    ? [...completed].sort((a, b) => a.result.lcosEurPerMwh - b.result.lcosEurPerMwh)[0]
    : null;
  const basePue = project.pue!;
  const basePrice = project.price;
  const sensitivityRows = [Math.max(1, basePue - 0.1), basePue, basePue + 0.1];
  const sensitivityColumns =
    basePrice === null ? [] : [Math.max(0, basePrice - 30), basePrice, basePrice + 30];
  return (
    <>
      <Title
        over="Project economics"
        title="Known exposure vs missing evidence"
        copy="No financial result appears until its required customer input exists."
      />
      <EvidenceLegend />
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
          value={lowestLcos ? `${eur.format(lowestLcos.result.lcosEurPerMwh)}/MWh` : "Unavailable"}
          note="Complete supplier inputs required"
        />
      </div>
      <div className="dca-grid-2">
        <article className="dca-card">
          <BarComparison
            title="Known annual cost exposure"
            unit="M€/year"
            items={[
              {
                label: "Commodity electricity",
                value: annualCost === null ? null : annualCost / 1_000_000,
                color: "#49d3ff",
                note: "Customer price × calculated demand",
              },
              { label: "Grid charges and levies", value: null, note: "Missing evidence" },
              {
                label: "Connection and reinforcement",
                value: null,
                note: "Missing operator/project evidence",
              },
              {
                label: "Lowest complete flexibility case",
                value: lowestLcos ? lowestLcos.result.annualCostEur / 1_000_000 : null,
                color: "#8b75ff",
                note: lowestLcos?.technology.name ?? "No complete scenario",
              },
            ]}
          />
        </article>
        {sensitivityColumns.length > 0 ? (
          <SensitivityMatrix
            title="Annual electricity-cost sensitivity"
            rows={sensitivityRows}
            columns={sensitivityColumns}
            calculate={(pue, price) =>
              ((project.it! * project.load!) / 100) * 8.76 * pue * 1000 * price
            }
          />
        ) : (
          <article className="dca-card">
            <Empty
              title="Sensitivity unavailable"
              copy="Enter an electricity price to calculate the PUE and price matrix."
            />
          </article>
        )}
      </div>
      {completed.length > 0 && (
        <article className="dca-card dca-wide-chart">
          <BarComparison
            title="Flexibility annual-cost comparison"
            unit="M€/year"
            items={completed.map(({ technology, result }) => ({
              label: technology.name,
              value: result.annualCostEur / 1_000_000,
              color: "#54d6a6",
            }))}
          />
        </article>
      )}
      <article className="dca-card dca-callout">
        <Leaf />
        <h3>Investment decision unavailable</h3>
        <p>
          A defensible NPV needs contracted prices, tariffs, connection and construction costs,
          taxes, financing, revenues and chronological dispatch. RZReg cannot supply them.
        </p>
      </article>
      <DecisionNote
        title={
          lowestLcos
            ? `${lowestLcos.technology.name} is the lowest-LCOS complete scenario—not yet a recommendation`
            : "Complete at least 1 supplier-backed flexibility scenario"
        }
        copy={
          lowestLcos
            ? "Compare site feasibility, reliability role, warranty, degradation and chronological dispatch before selecting a technology."
            : "Add technology costs and evidence references. NPV and payback remain unavailable until the wider commercial case is complete."
        }
      />
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
function DecisionNote({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="dca-decision-note">
      <div>
        <span>Decision interpretation</span>
        <h3>{title}</h3>
      </div>
      <p>{copy}</p>
    </section>
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
