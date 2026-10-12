import type { Scenario } from "@/lib/assessment-model";
import type { DispatchAnalysis } from "@/lib/fca-engine";
import { screenGermanOperator } from "@/lib/german-grid-screening";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { calculateFlexibility, calculateMaturity, canIssueOperatorPackage } from "../calculations";
import { buildConnectionOptions, rankConnectionOptions } from "../connection-options";
import { buildDecisionMatrix } from "../decision-matrix";
import { buildOperatorPackage } from "../deliverables";
import type { ProjectKind, SiteScreeningInput } from "../domain";
import {
  validateFlexibleLoadSpecification,
  type FlexibleLoadSpecification,
} from "../flexible-load";
import { execute as addCandidateCommand } from "./command-addCandidate";
import { execute as archiveScenarioCommand } from "./command-archiveScenario";
import { execute as createStandardScenariosCommand } from "./command-createStandardScenarios";
import { execute as duplicateScenarioCommand } from "./command-duplicateScenario";
import { execute as persistPackageCommand } from "./command-persistPackage";
import { execute as preferScenarioCommand } from "./command-preferScenario";
import { execute as runIntervalSimulationCommand } from "./command-runIntervalSimulation";
import { execute as saveDecisionCommand } from "./command-saveDecision";
import { execute as saveFlexibilityCommand } from "./command-saveFlexibility";
import { execute as savePilotSnapshotCommand } from "./command-savePilotSnapshot";
import { type Props } from "./contracts";
import { initialStrategyInput } from "./default-input";
import { number, optionKindForScenario } from "./presentation";
import { useStrategyRecords } from "./use-strategy-records";
export function useStrategyController({
  site,
  evidence,
  scenarios,
  profiles,
  refresh,
}: Props): import("./controller-contract").StrategyControllerContract {
  const [view, setView] = useState<"screen" | "options" | "flexibility" | "deliver">("screen");
  const [busy, setBusy] = useState(false);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [intervalResult, setIntervalResult] = useState<DispatchAnalysis | null>(null);
  const [input, setInput] = useState<FlexibleLoadSpecification>(() => initialStrategyInput(site));
  const siteIdentity = JSON.stringify([
    site.id,
    site.requested_import_mw,
    site.bess_power_mw,
    site.bess_energy_mwh,
  ]);
  const previousSiteIdentity = useRef(siteIdentity);
  useEffect(() => {
    if (previousSiteIdentity.current === siteIdentity) return;
    previousSiteIdentity.current = siteIdentity;
    setInput(initialStrategyInput(site));
    setIntervalResult(null);
  }, [siteIdentity, site]);
  const simulationIdentity = JSON.stringify([site.id, input, profiles]);
  const latestSimulationIdentity = useRef(simulationIdentity);
  latestSimulationIdentity.current = simulationIdentity;
  const simulationRevision = useRef(0);
  const simulationController = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      simulationRevision.current++;
      simulationController.current?.abort();
    },
    [simulationIdentity],
  );
  const screeningInput: SiteScreeningInput = {
    projectKind: ((site.project_kind as ProjectKind | null) ??
      (site.project_type === "bess" ? "battery_storage" : "other_large_consumer")) as ProjectKind,
    latitude: site.latitude,
    longitude: site.longitude,
    requestedImportMw: site.requested_import_mw,
    minimumViableImportMw: site.minimum_viable_import_mw ?? site.requested_import_mw,
    requestedExportMw: site.requested_export_mw,
    targetVoltageKv: site.target_voltage_kv ?? undefined,
    targetEnergisationDate: site.target_energization_date ?? undefined,
    landStatus: (site.land_status as SiteScreeningInput["landStatus"]) ?? "unknown",
    planningStatus: (site.planning_status as SiteScreeningInput["planningStatus"]) ?? "unknown",
    singleLineDiagramReady: site.single_line_diagram_ready ?? false,
    cableRouteStatus:
      (site.cable_route_status as SiteScreeningInput["cableRouteStatus"]) ?? "unknown",
    financeStatus: (site.finance_status as SiteScreeningInput["financeStatus"]) ?? "unknown",
  };
  const { strategyRecords, refetchStrategyRecords } = useStrategyRecords(site);
  const candidates = strategyRecords?.candidates ?? [];
  const packages = strategyRecords?.packages ?? [];
  const metrics = strategyRecords?.metrics ?? [];
  const activeScenarios = scenarios.filter((item) => item.status !== "archived");
  const preferredScenario = activeScenarios.find((item) => item.selection_status === "preferred");
  const maturity = calculateMaturity(screeningInput);
  const operator = screenGermanOperator(site.latitude, site.longitude);
  const result = useMemo(() => calculateFlexibility(input), [input]);
  const specificationValidation = useMemo(() => validateFlexibleLoadSpecification(input), [input]);
  const liveOptions = useMemo(
    () =>
      rankConnectionOptions(
        buildConnectionOptions({
          requestedImportMw: site.requested_import_mw,
          minimumViableImportMw: site.minimum_viable_import_mw ?? input.minimumCriticalLoadMw,
          reducedFirmImportMw: input.firmImportMw,
          conditionalImportMw: input.conditionalImportMw,
          operatorSupported: activeScenarios.some(
            (scenario) => scenario.status === "operator_validated",
          ),
          profile: profiles[0]?.points ?? null,
          dispatch: {
            minimumCriticalLoadMw: input.minimumCriticalLoadMw,
            shiftableLoadMw: input.shiftableLoadMw,
            batteryPowerMw: input.batteryPowerMw,
            batteryEnergyMwh: input.batteryEnergyMwh,
            batteryRoundTripEfficiency: input.batteryRoundTripEfficiency,
            batteryMinimumSoc: input.batteryMinimumSoc,
            initialBatterySoc: input.initialBatterySoc,
            energyValueEurMwh: input.energyValueEurMwh,
            batteryDegradationEurMwh: input.batteryDegradationEurMwh,
          },
        }),
      ),
    [activeScenarios, input, profiles, site.minimum_viable_import_mw, site.requested_import_mw],
  );
  const packageGate = canIssueOperatorPackage({
    evidenceReady: evidence.some((item) => item.validation_status === "validated"),
    siteMaturityScore: maturity.score,
    hasLoadProfile: profiles.length > 0,
  });
  const decisionMatrix = useMemo(() => buildDecisionMatrix(liveOptions), [liveOptions]);
  const preferredOption =
    decisionMatrix.find(
      (option) =>
        option.kind === (preferredScenario ? optionKindForScenario(preferredScenario) : ""),
    ) ?? null;
  const snapshot = buildOperatorPackage({
    site,
    evidence,
    scenarios,
    flexibility: result,
    options: liveOptions,
  });

  function analyse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setInput({
      requestedImportMw: number(form, "requestedImportMw"),
      firmImportMw: number(form, "firmImportMw"),
      conditionalImportMw: number(form, "conditionalImportMw"),
      minimumCriticalLoadMw: number(form, "minimumCriticalLoadMw"),
      shiftableLoadMw: number(form, "shiftableLoadMw"),
      batteryPowerMw: number(form, "batteryPowerMw"),
      batteryEnergyMwh: number(form, "batteryEnergyMwh"),
      restrictionDurationHours: number(form, "restrictionDurationHours"),
      restrictionEventsPerYear: number(form, "restrictionEventsPerYear"),
      energyValueEurMwh: number(form, "energyValueEurMwh"),
      batteryDegradationEurMwh: number(form, "batteryDegradationEurMwh"),
      maximumEventsPerDay: number(form, "maximumEventsPerDay"),
      recoveryHours: number(form, "recoveryHours"),
      geographicTransferMw: number(form, "geographicTransferMw"),
      notificationLeadMinutes: number(form, "notificationLeadMinutes"),
      rampDownMwPerMinute: number(form, "rampDownMwPerMinute"),
      rampUpMwPerMinute: number(form, "rampUpMwPerMinute"),
      upsPowerMw: number(form, "upsPowerMw"),
      upsEnergyMwh: number(form, "upsEnergyMwh"),
      generatorPowerMw: number(form, "generatorPowerMw"),
      generatorMaxHoursYear: number(form, "generatorMaxHoursYear"),
      batteryRoundTripEfficiency: Math.min(1, number(form, "batteryRoundTripEfficiency")),
      batteryMinimumSoc: Math.min(1, number(form, "batteryMinimumSoc")),
      initialBatterySoc: Math.min(1, number(form, "initialBatterySoc")),
    });
  }

  async function saveFlexibility() {
    return saveFlexibilityCommand({
      site,
      profiles,
      refresh,
      setBusy,
      input,
      result,
      specificationValidation,
    });
  }

  async function addCandidate(event: FormEvent<HTMLFormElement>) {
    return addCandidateCommand({ site, setCandidateBusy, refetchStrategyRecords }, event);
  }

  async function persistPackage(status: "draft" | "internal_review" | "approved" | "issued") {
    return persistPackageCommand(
      {
        site,
        evidence,
        scenarios,
        profiles,
        setBusy,
        refetchStrategyRecords,
        packages,
        result,
        packageGate,
        snapshot,
      },
      status,
    );
  }

  async function saveDecision() {
    return saveDecisionCommand({
      site,
      evidence,
      scenarios,
      refresh,
      setBusy,
      packages,
      preferredScenario,
    });
  }

  async function savePilotSnapshot() {
    return savePilotSnapshotCommand({
      site,
      evidence,
      setBusy,
      refetchStrategyRecords,
      candidates,
      result,
      decisionMatrix,
    });
  }

  const suggestedScenarios = [
    ["Requested firm", site.requested_import_mw, "Firm request; operator study required"],
    ["Reduced firm", input.firmImportMw, "Smaller initial connection"],
    [
      "Flexible envelope",
      input.firmImportMw + input.conditionalImportMw,
      result.compatible
        ? "Operationally compatible on declared inputs"
        : "Residual shortfall remains",
    ],
    [
      "Staged energisation",
      input.firmImportMw,
      `Transition toward ${site.requested_import_mw} MW after reinforcement`,
    ],
  ];

  async function createStandardScenarios() {
    return createStandardScenariosCommand({ site, evidence, refresh, setBusy, input });
  }

  async function preferScenario(scenarioId: string) {
    return preferScenarioCommand({ site, refresh, setBusy }, scenarioId);
  }

  async function duplicateScenario(scenario: Scenario) {
    return duplicateScenarioCommand({ site, refresh, setBusy }, scenario);
  }

  async function archiveScenario(scenario: Scenario) {
    return archiveScenarioCommand({ refresh, setBusy }, scenario);
  }

  async function runIntervalSimulation() {
    simulationController.current?.abort();
    const controller = new AbortController();
    simulationController.current = controller;
    const revision = ++simulationRevision.current;
    const isCurrent = () =>
      revision === simulationRevision.current &&
      latestSimulationIdentity.current === simulationIdentity;
    return runIntervalSimulationCommand(
      { site, scenarios, profiles, setIntervalResult, input },
      isCurrent,
      controller.signal,
    );
  }
  return {
    view,
    setView,
    busy,
    candidateBusy,
    intervalResult,
    input,
    strategyRecords,
    candidates,
    packages,
    metrics,
    activeScenarios,
    preferredScenario,
    maturity,
    operator,
    result,
    specificationValidation,
    liveOptions,
    packageGate,
    decisionMatrix,
    preferredOption,
    snapshot,
    analyse,
    saveFlexibility,
    addCandidate,
    persistPackage,
    saveDecision,
    savePilotSnapshot,
    suggestedScenarios,
    createStandardScenarios,
    preferScenario,
    duplicateScenario,
    archiveScenario,
    runIntervalSimulation,
    site,
    evidence,
    profiles,
    refresh,
    setBusy,
    setCandidateBusy,
    refetchStrategyRecords,
    scenarios,
    setIntervalResult,
  };
}
