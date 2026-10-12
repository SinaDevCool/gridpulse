import { createFileRoute } from "@tanstack/react-router";

import { useEffect,useMemo,useState } from "react";

import {
Activity,
BarChart3,
BatteryCharging,
Building2,
CircleDollarSign,
Database,
ShieldAlert,
SlidersHorizontal,
Zap,
} from "lucide-react";

import { AppShell } from "@/components/product/AppShell";

import { calculateDataCentreDesign } from "@/features/data-centre-planner/model";

import { selectPeers } from "@/features/data-centre-planner/benchmark";

import { calculateStorageLcos } from "@/features/data-centre-planner/storage-lcos";

import { CanonicalPlanningWorkbench } from "@/features/analytics/CanonicalPlanningWorkbench";

import {
type Artifact,
type FlexResult,
type Project,
type TechId,
type TechnologyScenarios,
type View,
} from "../features/legacy-planner/contracts";

import {
emptyProject,
emptyScenarios,
illustrativeProject,
STORAGE_KEY,
TECHNOLOGIES,
} from "../features/legacy-planner/presentation";

import { Overview } from "../features/legacy-planner/Overview";

import { Energy } from "../features/legacy-planner/Energy";

import { Benchmark } from "../features/legacy-planner/Benchmark";

import { Flexibility } from "../features/legacy-planner/Flexibility";

import { Economics } from "../features/legacy-planner/Economics";

import { N,TextField } from "../features/legacy-planner/primitives";

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
            <button
              type="button"
              onClick={() => {
                setProject(illustrativeProject);
                setView("overview");
              }}
            >
              <Database aria-hidden="true" />
              Load illustrative example
            </button>
            <button type="button" onClick={() => setDrawer(true)}>
              <SlidersHorizontal />
              Inputs & assumptions
            </button>
          </div>
        </header>
        <nav className="dca-tabs" aria-label="Analytics views">
          {(
            [
              ["overview", "Decision brief", Building2],
              ["energy", "Demand & energy", Zap],
              ["benchmark", "Peer evidence", BarChart3],
              ["flexibility", "Flexibility plan", BatteryCharging],
              ["economics", "Business case", CircleDollarSign],
              ["canonical", "Evidence & runs", Activity],
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
