import { useState } from "react";
import { OperationsEvidenceProvider } from "./OperationsEvidenceProvider";

import { Link,useNavigate } from "@tanstack/react-router";

import { Info } from "lucide-react";

import {
buildOperationsScenario,
defaultOperationsScenario,
type OperationsScenarioKind,
} from "./scenario-engine";

import { ComputeWorkloadsView } from "./ComputeWorkloadsView";

import { PowerBatteryView } from "./PowerBatteryView";

import { useOverviewAssessment } from "./hooks/use-overview-assessment";

import {
operatingWindowLabels,
operationsModeLabels,
scopeOperationsModel,
type OperatingWindowPreset,
type OperationsDataMode,
} from "./operating-context";

import { OperationsSelect } from "./OperationsSelect";

import { CanonicalPlanningWorkbench } from "../analytics/CanonicalPlanningWorkbench";

import { formatOperationsTime } from "./presentation";

import { type OperationsView } from "./view-contracts";

import { ScenarioEditor } from "./overview/ScenarioEditor";

import { OverviewView } from "./overview/OverviewView";

export { type OperationsView } from "./view-contracts";

export function OperationsDashboard(props: Parameters<typeof OperationsDashboardContent>[0]) {
  return (
    <OperationsEvidenceProvider>
      <OperationsDashboardContent {...props} />
    </OperationsEvidenceProvider>
  );
}

function OperationsDashboardContent({
  view,
  window,
  mode,
}: {
  view: OperationsView;
  window: OperatingWindowPreset;
  mode: OperationsDataMode;
}) {
  const navigate = useNavigate({ from: "/operations" });
  const [scenario, setScenario] = useState(defaultOperationsScenario);
  const [selected, setSelected] = useState<OperationsScenarioKind>("battery_workload");
  const [announcement, setAnnouncement] = useState("Default scenario loaded.");
  const { serverModel, assessmentIdentity, backendState } = useOverviewAssessment(scenario);
  const fullModel = serverModel ?? buildOperationsScenario(scenario);
  const model = scopeOperationsModel(fullModel, window);
  const viewCopy =
    view === "power"
      ? {
          eyebrow: "Data-Centre Power Operations",
          title: "Power & Battery",
          description: "Optimise facility power with battery storage and workload flexibility.",
          evidence:
            "Facility and battery values are scenario assumptions until measured evidence is connected.",
        }
      : view === "compute"
        ? {
            eyebrow: "Data-Centre Power Operations",
            title: "Power Operations",
            description: "Translate facility limits into compute and workload decisions.",
            evidence:
              "GPU workload behaviour uses the configured scenario until accepted telemetry is connected.",
          }
        : {
            eyebrow: "Data-Centre Power Operations",
            title: "Power Operations",
            description: "Translate facility limits into compute, battery, and workload decisions.",
            evidence:
              "Results use configured assumptions until measured facility evidence is connected.",
          };

  return (
    <main id="main-content" className={`operations-v2 operations-v2--${view}`}>
      <header className="operations-v2-header">
        <div>
          <p className="context-label">{viewCopy.eyebrow}</p>
          <h1>{viewCopy.title}</h1>
          <p>{viewCopy.description}</p>
        </div>
        <div className="operations-v2-context">
          <ScenarioEditor
            scenario={scenario}
            onApply={(next) => {
              setScenario(next);
              setAnnouncement("Scenario assumptions updated. Dashboard results recalculated.");
            }}
          />
        </div>
      </header>

      <div className="operations-v2-nav-row">
        <nav className="operations-v2-tabs" aria-label="Power Operations views">
          <OperationsTab
            id="overview"
            label="Overview"
            current={view}
            window={window}
            mode={mode}
          />
          <OperationsTab
            id="compute"
            label="Compute & Workloads"
            current={view}
            window={window}
            mode={mode}
          />
          <OperationsTab
            id="power"
            label="Power & Battery"
            current={view}
            window={window}
            mode={mode}
          />
        </nav>
        <p className="operations-v2-provenance">
          <Info aria-hidden="true" />
          <span>
            <strong>Scenario assessment—not live control</strong>
          </span>
        </p>
      </div>

      <section className="operations-context-strip" aria-label="Operating context">
        <div className="operations-context-field">
          <span>Facility</span>
          <strong>{scenario.facilityName}</strong>
        </div>
        <div className="operations-context-field">
          <OperationsSelect
            name="operating-window"
            label={mode === "historical" ? "Scenario window (inactive)" : "Operating Window"}
            disabled={mode === "historical"}
            value={window}
            options={Object.entries(operatingWindowLabels).map(([value, label]) => ({
              value: value as OperatingWindowPreset,
              label,
            }))}
            onChange={(nextWindow) =>
              navigate({
                search: { view, window: nextWindow, mode },
                replace: true,
              })
            }
          />
        </div>
        <div className="operations-context-field">
          <OperationsSelect
            name="data-mode"
            label="Data Mode"
            value={mode}
            options={Object.entries(operationsModeLabels).map(([value, label]) => ({
              value: value as OperationsDataMode,
              label,
              disabled: value === "live" || (value === "historical" && view !== "power"),
              description:
                value === "scenario"
                  ? "Configured inputs"
                  : value === "historical"
                    ? "Power & Battery evidence workspace"
                    : "Live connector not connected",
            }))}
            onChange={(nextMode) =>
              navigate({
                search: { view, window, mode: nextMode },
                replace: true,
              })
            }
          />
        </div>
        <div className="operations-context-health" role="status">
          <i className={backendState} aria-hidden="true" />
          <span>
            <strong>
              {backendState === "verified"
                ? "Calculation service available"
                : backendState === "checking"
                  ? "Calculation pending…"
                  : "Browser calculation"}
            </strong>
            {mode === "historical"
              ? "Uploaded evidence workspace"
              : `${model.intervals.length} displayed intervals · Scenario only`}
          </span>
        </div>
      </section>
      <p className="operations-assessment-date" hidden={mode === "historical"}>
        Scenario data: {formatOperationsTime(model.intervals[0].timestamp, true)} –{" "}
        {formatOperationsTime(model.intervals.at(-1)!.timestamp)}. Window presets select simulated
        intervals, not a live forecast.
      </p>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {view === "overview" ? (
        <OverviewView model={model} selected={selected} onSelect={setSelected} />
      ) : null}
      {/* The workspace provider retains evidence and selection; inactive charts do not mount. */}
      {view === "compute" ? <ComputeWorkloadsView model={fullModel} displayModel={model} /> : null}
      {view === "power" ? (
        <PowerBatteryView
          model={fullModel}
          displayModel={model}
          mode={mode === "historical" ? "historical" : "scenario"}
          onModeChange={(nextMode) =>
            navigate({ search: { view: "power", window, mode: nextMode }, replace: true })
          }
        />
      ) : null}
      <details className="operations-assurance-panel operations-technical-details">
        <summary>Assessment details & advanced planning</summary>
        <p>
          {assessmentIdentity
            ? `Assessment ${assessmentIdentity.id} · Calculated ${formatOperationsTime(assessmentIdentity.generatedAt, true)}`
            : "Calculation pending or browser demonstration—not an operational plan"}
        </p>
        <p>
          Full planning horizon: {fullModel.intervals.length} intervals. Recovery and battery state
          are calculated over this horizon before display-window filtering.
        </p>
        <details>
          <summary>Canonical planning, rolling analysis & historical replay</summary>
          <p>
            Authenticated model-contract workspace; separate from the aggregate scenario
            demonstration. No physical commands are issued.
          </p>
          <CanonicalPlanningWorkbench />
        </details>
      </details>
    </main>
  );
}

function OperationsTab({
  id,
  label,
  current,
  window,
  mode,
}: {
  id: OperationsView;
  label: string;
  current: OperationsView;
  window: OperatingWindowPreset;
  mode: OperationsDataMode;
}) {
  return (
    <Link
      to="/operations"
      search={{ view: id, window, mode: id === "power" ? mode : "scenario" }}
      className={current === id ? "active" : undefined}
      aria-current={current === id ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
