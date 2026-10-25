import { useEffect, useMemo, useRef, useState } from "react";
import { SYNTHETIC_RESOLUTION_LABEL } from "./synthetic-milp-request";
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
import { stableOperationsJson } from "@/lib/operations-request";
import { selectCanonicalPresentation } from "./canonical-presentation";
import { CanonicalAssessmentView } from "./CanonicalAssessmentView";
import { PlanCopilot } from "./copilot/PlanCopilot";
import { usePlanCopilot } from "./copilot/use-plan-copilot";
import { usePlanConversation } from "./copilot/use-plan-conversation";
import { PlanConversation } from "./copilot/PlanConversation";
import { contextLabel } from "./copilot/conversation-presentation";
import type { CopilotNavigation } from "./copilot/conversation-contracts";
import { useMilpCalculation } from "./hooks/use-milp-calculation";
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
  const milpEnabled = import.meta.env.VITE_OPERATIONS_MILP_ENABLED === "true";
  // The enabled optimiser is the single public planning experience. Legacy
  // calculator preferences must not silently select a different calculation path.
  const milp = useMilpCalculation();
  const canonical = milp.result;
  const setCanonical = milp.setResult;
  const draft = useScenarioDraft(scenario, value => {
    setScenario(value);
    if (milpEnabled && mode !== "historical") void milp.run(value);
  });
  const [canonicalTime, setCanonicalTime] = useState("");
  const [canonicalPreview, setCanonicalPreview] = useState<string | null>(null);
  const [canonicalWorkload, setCanonicalWorkload] = useState<string | null>(null);
  const canonicalCurrent = canonical && !draft.dirty && canonical.scenarioIdentity === stableOperationsJson(scenario);
  const copilot = usePlanCopilot({ jobId: canonical?.jobId,
    fingerprint: canonical?.assessment.projected.identity.resultFingerprint ?? "", current: !!canonicalCurrent });
  const chatContext: CopilotNavigation = { view, timestamp: canonicalTime || null, workloadId: canonicalWorkload };
  const conversation = usePlanConversation(canonical?.jobId,
    canonical?.assessment.projected.identity.resultFingerprint ?? "", !!canonicalCurrent, chatContext);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const copilotTrigger = useRef<HTMLButtonElement>(null);
  const [inspection, setInspection] = useState<CopilotNavigation | null>(null);
  const assessmentRegion = useRef<HTMLDivElement>(null);
  function closeCopilot() { setCopilotOpen(false); copilotTrigger.current?.focus(); }
  useEffect(() => {
    if (!inspection || inspection.view !== view) return;
    const frame = requestAnimationFrame(() => {
      const region = assessmentRegion.current;
      region?.scrollIntoView({ block: "start", behavior: "instant" }); region?.focus();
      setInspection(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [inspection, view]);
  function inspectCopilot(target: CopilotNavigation) {
    if (!canonicalCurrent || !canonical) return;
    if (target.timestamp && !canonical.assessment.points.some(point => point.timestamp === target.timestamp)) return;
    if (target.workloadId && !canonical.assessment.jobs.some(job => job.id === target.workloadId)) return;
    if (target.timestamp) setCanonicalTime(target.timestamp);
    setCanonicalWorkload(target.workloadId); setCanonicalPreview(null);
    setCopilotOpen(false); setInspection(target);
    void navigate({ search: { view: target.view, window, mode } });
  }
  const showMilp = milpEnabled && mode !== "historical";
  const calculationBusy = showMilp ? milp.busy : lifecycle === "loading" || lifecycle === "stale";
  useEffect(() => {
    if (canonical) { setCanonicalTime(canonical.assessment.points[0].timestamp); setCanonicalPreview(null); setCanonicalWorkload(null); }
  }, [canonical]);
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
                busy={calculationBusy}
                milp={showMilp}
                onDiscard={draft.discard}
              />
            }
          >
            <WorkspaceInputs
              milp={showMilp}
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
              busy={calculationBusy}
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
              <strong>{showMilp ? "Optimised planning · synthetic model" : serviceLabel}</strong>
              <small>Read-only assessment · no physical commands</small>
            </div>
            <AdvancedAnalysis operations={showMilp ? {
              scenario,
              onInvalidated: () => setCanonical(null),
              onAccepted: (job, request, scenarioIdentity) => {
                const assessment = selectCanonicalPresentation(job, request);
                setCanonical({ assessment, scenarioIdentity, jobId: job.id });
                setCanonicalTime(assessment.points[0].timestamp);
                setCanonicalPreview(null);
              },
            } : undefined} />
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
                {showMilp && canonical ? <button ref={copilotTrigger} className="secondary-button ops-copilot-trigger" type="button"
                  aria-controls="plan-copilot" aria-expanded={copilotOpen} onClick={() => setCopilotOpen(value => !value)}>Plan copilot</button> : null}
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
                  {showMilp ? milp.busy ? "Optimising plan…" : "Optimiser · on-demand service" : serviceLabel}
                </span>
              </div>
              <p className="ops-assessment-notice" role="status">
                {draft.dirty ? "Unapplied changes. Results still use the applied scenario. " : ""}
                {mode === "historical"
                  ? "Uploaded evidence, not live control."
                  : showMilp ? `Synthetic model · ${SYNTHETIC_RESOLUTION_LABEL} · illustrative profiles and component assumptions, not customer telemetry. PUE is reference-only.` : "Scenario assessment—not live control."}
                {!showMilp && (lifecycle === "loading" || lifecycle === "stale")
                  ? " Calculation pending; browser preview is not a backend-validated plan."
                  : !showMilp && backendState === "unavailable"
                    ? " Backend unavailable; browser demonstration only."
                    : ""}
              </p>
              {showMilp ? <section className="ops-milp-status" aria-label="MILP calculation status" aria-busy={milp.busy}>
                <p role="status"><strong>Optimised planning</strong> · {milp.busy ? `${milp.job?.status ?? "Connecting"} · the free service may need time to wake up.` : milp.error ? "Calculation needs attention" : canonical ? "Calculation complete · workload and battery plan" : "Ready · use Optimise plan"}</p>
                {milp.jobId ? <details><summary>Calculation receipt</summary><p>Job {milp.jobId} · {milp.job?.status ?? "submitted"}</p></details> : null}
                {milp.error ? <p role="alert">{milp.error}</p> : null}
                {milp.busy ? <button type="button" className="secondary-button" onClick={() => void milp.cancel()}>Request cancellation</button> : null}
                {!milp.busy && milp.jobId && milp.error ? <button type="button" className="secondary-button"
                  onClick={() => void milp.run(scenario, milp.jobId!)}>Resume existing job · no new solve</button> : null}
              </section> : null}
              <div ref={assessmentRegion} className="ops-copilot-inspection-target" tabIndex={-1} role="region" aria-label="Selected assessment evidence">
              {showMilp ? canonical && canonicalCurrent ? <CanonicalAssessmentView assessment={canonical.assessment}
                view={view} timestamp={canonicalTime} selectedWorkloadId={canonicalWorkload} onWorkloadSelect={setCanonicalWorkload}
                onSelect={value => { setCanonicalTime(value); setCanonicalPreview(null); }}
                preview={canonicalPreview} onPreview={setCanonicalPreview} /> : <section className="data-panel" role="status">
                  <h2>{canonical ? "Plan inputs changed" : "No optimised plan yet"}</h2>
                  <p>{canonical ? "This result is stale. Use Optimise plan with the current inputs." : "Use Optimise plan in the input panel to calculate a workload and battery schedule."}</p>
                  <p>No scenario result is substituted in this view. No equipment commands are issued.</p>
                </section> : null}
              </div>
              {!showMilp && view === "overview" ? (
                <OverviewView
                  model={model}
                  fullModel={fullModel}
                  selected={selected}
                  onSelect={setSelected}
                />
              ) : null}
              {!showMilp && view === "compute" ? (
                <ComputeWorkloadsView model={fullModel} displayModel={model} />
              ) : null}
              {!showMilp && view === "power" ? (
                <PowerBatteryView
                  model={fullModel}
                  displayModel={model}
                  mode={mode === "historical" ? "historical" : "scenario"}
                  onModeChange={(value) =>
                    navigate({ search: { view: "power", window, mode: value }, replace: true })
                  }
                />
              ) : null}
              {!showMilp && view === "overview" ? (
                <AssessmentRecord fullModel={fullModel} assessmentIdentity={assessmentIdentity} />
              ) : null}
            </div>
            {showMilp && canonical ? <PlanCopilot state={copilot} jobId={canonical.jobId} current={!!canonicalCurrent}
              open={copilotOpen} onClose={closeCopilot} context={<>{contextLabel(chatContext, canonical.assessment.points.find(point => point.timestamp === canonicalTime)?.endTimestamp)}{canonicalWorkload ? <strong>{String(canonical.assessment.request.workloads.find(job => job.workload_id === canonicalWorkload)?.name ?? canonicalWorkload)}</strong> : null}</>}
              onNavigate={nextView => inspectCopilot({ view: nextView, timestamp: null, workloadId: null })}>
              <PlanConversation active={copilotOpen} state={conversation} enabled={!!canonicalCurrent} context={chatContext}
                identity={`${canonical.jobId}:${canonical.assessment.projected.identity.resultFingerprint}`} onNavigate={inspectCopilot} />
            </PlanCopilot> : null}
          </div>
        </main>
      </InputPanelContext.Provider>
    </WorkloadEvidenceProvider>
  );
}
