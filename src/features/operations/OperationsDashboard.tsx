import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { OperationsEvidenceProvider } from "./OperationsEvidenceProvider";
import { defaultOperationsScenario, type OperationsScenarioKind } from "./scenario-engine";
import { ComputeWorkloadsView } from "./ComputeWorkloadsView";
import { PowerBatteryView } from "./PowerBatteryView";
import { useOverviewAssessment } from "./hooks/use-overview-assessment";
import {
  operatingWindowLabels,
  scopeOperationsModel,
  type OperatingWindowPreset,
  type OperationsDataMode,
} from "./operating-context";
import { AdvancedAnalysis } from "./configuration/AdvancedAnalysis";
import { AssessmentRecord } from "./configuration/AssessmentRecord";
import type { OperationsView } from "./view-contracts";
import { OverviewView } from "./overview/OverviewView";
import { ConfigurationActions, ConfigurationForm } from "./configuration/ConfigurationForm";
import { OperationsExitGuard } from "./configuration/OperationsExitGuard";
import { ConfigurationPanel } from "./configuration/ConfigurationPanel";
import { WorkspaceInputs } from "./configuration/WorkspaceInputs";
import { EvidenceInputs } from "./configuration/EvidenceInputs";
import { EvidenceReadiness } from "./configuration/EvidenceReadiness";
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
  const { serverModel, fallbackModel, assessmentIdentity, backendState, lifecycle } =
    useOverviewAssessment(scenario);
  const fullModel = serverModel ?? fallbackModel;
  const model = useMemo(() => scopeOperationsModel(fullModel, window), [fullModel, window]);
  const layout = usePanelLayout();
  const trigger = useRef<HTMLButtonElement>(null);
  const results = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (location.hash) return;
    const frame = requestAnimationFrame(() =>
      results.current?.scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [view]);
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
        <OperationsExitGuard dirty={draft.dirty} />
        <main
          id="main-content"
          className={`operations-v2 operations-v2--${view} ops-control-layout ${layout.open && !layout.mobile ? "inputs-open" : ""}`}
        >
          <ConfigurationPanel
            open={layout.open}
            mobile={layout.mobile}
            onClose={closeInputs}
            actions={
              <ConfigurationActions
                dirty={draft.dirty}
                busy={lifecycle === "loading" || lifecycle === "stale"}
                onDiscard={draft.discard}
              />
            }
          >
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
            <EvidenceReadiness />
            {view !== "overview" ? (
              <AssessmentRecord fullModel={fullModel} assessmentIdentity={assessmentIdentity} />
            ) : null}
            <div className="ops-panel-service" role="status">
              <strong>{serviceLabel}</strong>
              <small>Read-only assessment · no physical commands</small>
            </div>
            <AdvancedAnalysis />
          </ConfigurationPanel>
          <div className="ops-dashboard-canvas">
            <h1 className="sr-only">{view === "power" ? "Power & Battery" : "Power Operations"}</h1>
            <div className="ops-canvas-toolbar">
              <header className="ops-workspace-header">
                <button
                  ref={trigger}
                  type="button"
                  className="secondary-button ops-input-trigger"
                  disabled={!layout.ready}
                  aria-controls="operations-inputs"
                  aria-expanded={layout.open}
                  aria-label={layout.open ? "Hide panel" : "Show panel"}
                  onClick={() => (layout.open ? closeInputs() : openInputs())}
                >
                  {layout.open ? (
                    <PanelLeftClose aria-hidden="true" />
                  ) : (
                    <PanelLeftOpen aria-hidden="true" />
                  )}
                  {layout.open ? "Hide panel" : "Show panel"}
                  {draft.dirty ? (
                    <span className="ops-draft-dot" aria-label="Unapplied changes">
                      •
                    </span>
                  ) : null}
                </button>
              </header>
            </div>
            <div
              key={view}
              ref={results}
              data-scroll-restoration-id={`operations-results-${view}`}
              className="ops-canvas-content"
              role="region"
              aria-label="Operations results"
              tabIndex={0}
            >
              <div className="ops-context-summary">
                <p>
                  {scenario.facilityName} ·{" "}
                  {mode === "historical" ? "Uploaded historical evidence" : "Scenario"} ·{" "}
                  {mode === "historical"
                    ? "Complete uploaded range"
                    : operatingWindowLabels[window]}{" "}
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
                <OverviewView
                  model={model}
                  fullModel={fullModel}
                  selected={selected}
                  onSelect={setSelected}
                />
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
              {view === "overview" ? (
                <AssessmentRecord fullModel={fullModel} assessmentIdentity={assessmentIdentity} />
              ) : null}
            </div>
          </div>
        </main>
      </InputPanelContext.Provider>
    </WorkloadEvidenceProvider>
  );
}
