import type { OperatorPackage,ProjectSiteCandidate,Scenario } from "@/lib/assessment-model";
import type { DispatchAnalysis } from "@/lib/fca-engine";
import { screenGermanOperator } from "@/lib/german-grid-screening";
import { useQuery } from "@tanstack/react-query";
import { useMemo,useState,type FormEvent } from "react";
import { calculateFlexibility,calculateMaturity,canIssueOperatorPackage } from "../calculations";
import { buildConnectionOptions,rankConnectionOptions } from "../connection-options";
import { buildDecisionMatrix } from "../decision-matrix";
import { buildOperatorPackage } from "../deliverables";
import type { ProjectKind,SiteScreeningInput } from "../domain";
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
import { number,optionKindForScenario } from "./presentation";
import * as strategyQueries from "./repository-use-strategy-controller";
export function useStrategyController({ site, evidence, scenarios, profiles, refresh }: Props) {
  const [view, setView] = useState<"screen" | "options" | "flexibility" | "deliver">("screen");
  const [busy, setBusy] = useState(false);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [intervalResult, setIntervalResult] = useState<DispatchAnalysis | null>(null);
  const [input, setInput] = useState<FlexibleLoadSpecification>({
    requestedImportMw: site.requested_import_mw,
    firmImportMw: Math.max(0, site.requested_import_mw * 0.65),
    conditionalImportMw: Math.max(0, site.requested_import_mw * 0.15),
    minimumCriticalLoadMw: Math.max(0, site.requested_import_mw * 0.5),
    shiftableLoadMw: Math.max(0, site.requested_import_mw * 0.1),
    batteryPowerMw: site.bess_power_mw ?? 0,
    batteryEnergyMwh: site.bess_energy_mwh ?? 0,
    restrictionDurationHours: 2,
    restrictionEventsPerYear: 20,
    energyValueEurMwh: 200,
    batteryDegradationEurMwh: 20,
    maximumEventsPerDay: 2,
    recoveryHours: 4,
    geographicTransferMw: 0,
    notificationLeadMinutes: 30,
    rampDownMwPerMinute: 0,
    rampUpMwPerMinute: 0,
    upsPowerMw: 0,
    upsEnergyMwh: 0,
    generatorPowerMw: 0,
    generatorMaxHoursYear: 0,
    batteryRoundTripEfficiency: 0.9,
    batteryMinimumSoc: 0.1,
    initialBatterySoc: 1,
  });
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
  const { data: strategyRecords, refetch: refetchStrategyRecords } = useQuery({
    queryKey: ["connection-strategy-records", site.id],
    queryFn: async () => {
      const [candidateResponse, packageResponse, metricResponse, engagementResponse] =
        await Promise.all([
          strategyQueries.selectProjectSiteCandidates1(site),
          strategyQueries.selectOperatorPackages2(site),
          strategyQueries.selectPilotMetrics3(site),
          strategyQueries.selectOperatorEngagements4(site),
        ]);
      if (candidateResponse.error) throw candidateResponse.error;
      if (packageResponse.error) throw packageResponse.error;
      if (metricResponse.error) throw metricResponse.error;
      if (engagementResponse.error) throw engagementResponse.error;
      return {
        candidates: candidateResponse.data as ProjectSiteCandidate[],
        packages: packageResponse.data as OperatorPackage[],
        metrics: metricResponse.data,
        engagement: engagementResponse.data,
      };
    },
  });
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
    return runIntervalSimulationCommand({ site, scenarios, profiles, setIntervalResult, input });
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
