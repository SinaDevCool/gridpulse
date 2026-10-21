import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PanelLeft } from "lucide-react";
import { OperationsEvidenceProvider } from "./OperationsEvidenceProvider";
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
  scopeOperationsModel,
  type OperatingWindowPreset,
  type OperationsDataMode,
} from "./operating-context";
import { CanonicalPlanningWorkbench } from "../analytics/CanonicalPlanningWorkbench";
import { formatOperationsTime } from "./presentation";
import type { OperationsView } from "./view-contracts";
import { OverviewView } from "./overview/OverviewView";
import { ConfigurationForm } from "./configuration/ConfigurationForm";
import { ConfigurationPanel } from "./configuration/ConfigurationPanel";
import { WorkspaceInputs } from "./configuration/WorkspaceInputs";
import { EvidenceInputs } from "./configuration/EvidenceInputs";
import { useScenarioDraft } from "./configuration/use-scenario-draft";
import { usePanelLayout } from "./configuration/use-panel-layout";
import { InputPanelContext } from "./configuration/input-panel-context";
import { WorkloadEvidenceProvider } from "./WorkloadEvidenceProvider";
export type { OperationsView } from "./view-contracts";

type Props = { view: OperationsView; window: OperatingWindowPreset; mode: OperationsDataMode };
export function OperationsDashboard(props: Props) {
  return (
    <OperationsEvidenceProvider>
      <OperationsDashboardContent {...props} />
    </OperationsEvidenceProvider>
  );
}

function OperationsDashboardContent({ view, window, mode }: Props) {
  const navigate = useNavigate({ from: "/operations" });
  const [scenario, setScenario] = useState(defaultOperationsScenario);
  const [selected, setSelected] = useState<OperationsScenarioKind>("battery_workload");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { serverModel, assessmentIdentity, backendState, lifecycle } =
    useOverviewAssessment(scenario);
  const fallbackModel = useMemo(() => buildOperationsScenario(scenario), [scenario]);
  const fullModel = serverModel ?? fallbackModel;
  const model = useMemo(() => scopeOperationsModel(fullModel, window), [fullModel, window]);
  const layout = usePanelLayout();
  const trigger = useRef<HTMLButtonElement>(null);
  const draft = useScenarioDraft(scenario, setScenario);
  const serviceLabel =
    backendState === "verified"
      ? "Calculation service available"
      : backendState === "checking"
        ? "Calculation pending…"
        : "Browser calculation · backend unavailable";
  function closeInputs() {
    layout.setOpen(false);
    trigger.current?.focus();
  }
  function openInputs(evidence = false) {
    layout.setOpen(true);
    if (evidence) setEvidenceOpen(true);
  }
  return (
    <WorkloadEvidenceProvider model={fullModel}>
      <InputPanelContext.Provider value={openInputs}>
        <main
          id="main-content"
          className={`operations-v2 operations-v2--${view} ops-control-layout ${layout.open && !layout.mobile ? "inputs-open" : ""}`}
        >
          <header className="ops-workspace-header">
            <div>
              <p className="context-label">Data-centre power operations</p>
              <h1>{view === "power" ? "Power & Battery" : "Power Operations"}</h1>
            </div>
            <button
              ref={trigger}
              type="button"
              className="secondary-button ops-input-trigger"
              disabled={!layout.ready}
              aria-controls="operations-inputs"
              aria-expanded={layout.open}
              onClick={() => (layout.open ? closeInputs() : openInputs())}
            >
              <PanelLeft aria-hidden="true" />
              Inputs{draft.dirty ? " · Unapplied changes" : ""}
            </button>
          </header>
          <ConfigurationPanel open={layout.open} mobile={layout.mobile} onClose={closeInputs}>
            <WorkspaceInputs
              model={fullModel}
              mode={mode}
              window={window}
              view={view}
              onWindow={(value) =>
                navigate({ search: { view, window: value, mode }, replace: true })
              }
              onMode={(value) => navigate({ search: { view, window, mode: value }, replace: true })}
            />
            <ConfigurationForm
              draft={draft.draft}
              onChange={draft.setDraft}
              dirty={draft.dirty}
              errors={draft.errors}
              busy={lifecycle === "loading" || lifecycle === "stale"}
              historical={mode === "historical"}
              onApply={draft.apply}
              onDiscard={draft.discard}
            />
            <details
              className="ops-evidence-section"
              open={evidenceOpen}
              onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}
            >
              <summary>Evidence imports</summary>
              <EvidenceInputs
                model={fullModel}
                onHistorical={() =>
                  navigate({ search: { view: "power", window, mode: "historical" }, replace: true })
                }
              />
            </details>
            <div className="ops-panel-service" role="status">
              <strong>{serviceLabel}</strong>
              <small>Read-only assessment · no physical commands</small>
            </div>
          </ConfigurationPanel>
          <div className="ops-dashboard-canvas">
            <nav className="operations-v2-tabs" aria-label="Power Operations views">
              {[
                ["overview", "Overview"],
                ["compute", "Compute & Workloads"],
                ["power", "Power & Battery"],
              ].map(([id, label]) => (
                <Link
                  key={id}
                  to="/operations"
                  search={{ view: id, window, mode: id === "power" ? mode : "scenario" }}
                  className={view === id ? "active" : undefined}
                  aria-current={view === id ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="ops-context-summary">
              <p>
                {scenario.facilityName} ·{" "}
                {mode === "historical" ? "Uploaded historical evidence" : "Scenario"} ·{" "}
                {mode === "historical" ? "Complete uploaded range" : operatingWindowLabels[window]}{" "}
                · UTC
              </p>
              <span className={`ops-service-status ${backendState}`} role="status">
                {serviceLabel}
              </span>
            </div>
            <p className="ops-assessment-notice" role="status">
              {draft.dirty ? "Unapplied changes. Results still use the applied scenario. " : ""}
              {mode === "historical"
                ? "Uploaded evidence, not live control."
                : "Scenario assessment—not live control."}
              {lifecycle === "loading" || lifecycle === "stale"
                ? " Calculation pending; browser preview is not a backend-validated plan."
                : backendState === "unavailable"
                  ? " Backend unavailable; browser demonstration only."
                  : ""}
            </p>
            {view === "overview" ? (
              <OverviewView model={model} selected={selected} onSelect={setSelected} />
            ) : null}
            {view === "compute" ? (
              <ComputeWorkloadsView model={fullModel} displayModel={model} />
            ) : null}
            {view === "power" ? (
              <PowerBatteryView
                model={fullModel}
                displayModel={model}
                mode={mode === "historical" ? "historical" : "scenario"}
                onModeChange={(value) =>
                  navigate({ search: { view: "power", window, mode: value }, replace: true })
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
                Full planning horizon: {fullModel.intervals.length} intervals. Recovery and battery
                state are calculated over this horizon before display-window filtering.
              </p>
              {fullModel.planningTime ? (
                <p>
                  Calculation coverage:{" "}
                  {formatOperationsTime(fullModel.planningTime.calculation.start, true)} –{" "}
                  {formatOperationsTime(fullModel.planningTime.calculation.end, true)}. Purpose:
                  synthetic scenario. Terminal policy: report unfinished work, not guaranteed
                  completion. No forward forecast or rolling control is enabled.
                </p>
              ) : null}
              <details>
                <summary>Canonical planning, rolling analysis & historical replay</summary>
                <p>
                  Separate authenticated model-contract interface. Engine availability is not
                  established by the scenario service. No physical commands are issued.
                </p>
                <CanonicalPlanningWorkbench />
              </details>
            </details>
          </div>
        </main>
      </InputPanelContext.Provider>
    </WorkloadEvidenceProvider>
  );
}
