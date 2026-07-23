import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Download, Info, MapPin, ShieldAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { simulateFlexibleConnection, type DispatchAnalysis } from "@/lib/fca-engine";
import type {
  CandidateSite,
  Evidence,
  IntervalProfile,
  OperatorPackage,
  ProjectSiteCandidate,
  Scenario,
} from "@/lib/assessment-model";
import { screenGermanOperator } from "@/lib/german-grid-screening";
import { calculateFlexibility, calculateMaturity, canIssueOperatorPackage } from "./calculations";
import { buildDecisionMemo, buildOperatorPackage, downloadJson } from "./deliverables";
import { downloadOperatorPackagePdf } from "./operator-pdf";
import { buildConnectionOptions, rankConnectionOptions } from "./connection-options";
import { buildDecisionMatrix } from "./decision-matrix";
import { assessCandidateDimensions } from "./site-comparison";
import { CommercialDecisionGate } from "./CommercialDecisionGate";
import type { ProjectKind, SiteScreeningInput } from "./domain";
import {
  FLEXIBLE_LOAD_SPECIFICATION_VERSION,
  validateFlexibleLoadSpecification,
  type FlexibleLoadSpecification,
} from "./flexible-load";

type Props = {
  site: CandidateSite;
  evidence: Evidence[];
  scenarios: Scenario[];
  profiles: IntervalProfile[];
  refresh: () => Promise<void>;
};

const number = (form: FormData, key: string) => Math.max(0, Number(form.get(key)) || 0);

function strategyPathSummary(scenario: Scenario) {
  const schedule = scenario.restriction_schedule as {
    startHour?: number;
    endHour?: number;
    timezone?: string;
  } | null;
  if (schedule?.startHour !== undefined && schedule.endHour !== undefined) {
    return `Candidate restriction window ${String(schedule.startHour).padStart(2, "0")}:00–${String(schedule.endHour).padStart(2, "0")}:00 ${schedule.timezone ?? ""}`;
  }
  const dependencies = Array.isArray(scenario.dependencies) ? scenario.dependencies : [];
  const milestone = dependencies.find(
    (item): item is { milestone: string; importMw?: number } =>
      typeof item === "object" && item !== null && "milestone" in item,
  );
  if (milestone) return `${milestone.milestone}: ${milestone.importMw ?? "open"} MW`;
  return scenario.scenario_type
    ? scenario.scenario_type.replaceAll("_", " ")
    : scenario.connection_mode;
}

function optionKindForScenario(scenario: Scenario) {
  return scenario.scenario_type === "staged_energisation" ? "staged" : scenario.scenario_type;
}

export function StrategyWorkbench({ site, evidence, scenarios, profiles, refresh }: Props) {
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
          supabase
            .from("project_site_candidates")
            .select("*")
            .eq("site_id", site.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("operator_packages")
            .select("*")
            .eq("site_id", site.id)
            .order("version", { ascending: false }),
          supabase
            .from("pilot_metrics")
            .select("*")
            .eq("site_id", site.id)
            .order("observed_at", { ascending: false }),
          supabase
            .from("operator_engagements")
            .select("estimated_connection_cost_eur,indicated_connection_date")
            .eq("site_id", site.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
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
    setBusy(true);
    const profileName = "Declared operating flexibility";
    const previous = await supabase
      .from("flexibility_profiles")
      .select("id,version")
      .eq("site_id", site.id)
      .eq("name", profileName)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous.error) {
      setBusy(false);
      toast.error(previous.error.message);
      return;
    }
    const { error } = await supabase.from("flexibility_profiles").insert({
      site_id: site.id,
      name: profileName,
      version: (previous.data?.version ?? 0) + 1,
      supersedes_id: previous.data?.id ?? null,
      requested_import_mw: input.requestedImportMw,
      firm_import_mw: input.firmImportMw,
      conditional_import_mw: input.conditionalImportMw,
      minimum_critical_load_mw: input.minimumCriticalLoadMw,
      shiftable_load_mw: input.shiftableLoadMw,
      battery_power_mw: input.batteryPowerMw,
      battery_energy_mwh: input.batteryEnergyMwh,
      restriction_duration_hours: input.restrictionDurationHours,
      restriction_events_per_year: input.restrictionEventsPerYear,
      maximum_curtailment_mw: specificationValidation.derived.maximumCurtailmentMw,
      maximum_event_duration_hours: input.restrictionDurationHours,
      maximum_events_per_day: input.maximumEventsPerDay,
      recovery_hours: input.recoveryHours,
      geographic_transfer_mw: input.geographicTransferMw,
      notification_lead_minutes: input.notificationLeadMinutes,
      ramp_down_mw_per_min: input.rampDownMwPerMinute,
      ramp_up_mw_per_min: input.rampUpMwPerMinute,
      ups_power_mw: input.upsPowerMw,
      ups_energy_mwh: input.upsEnergyMwh,
      generator_power_mw: input.generatorPowerMw,
      generator_max_hours_year: input.generatorMaxHoursYear,
      battery_round_trip_efficiency: input.batteryRoundTripEfficiency,
      battery_minimum_soc: input.batteryMinimumSoc,
      initial_battery_soc: input.initialBatterySoc,
      profile_id: profiles[0]?.id ?? null,
      validation_report: specificationValidation,
      specification_version: FLEXIBLE_LOAD_SPECIFICATION_VERSION,
      commercial_assumptions: {
        energyValueEurMwh: input.energyValueEurMwh,
        batteryDegradationEurMwh: input.batteryDegradationEurMwh,
      },
      result,
      status: "calculated",
    });
    setBusy(false);
    if (error) toast.error(`${error.message}. Apply the Phase 2 database migration first.`);
    else {
      toast.success("Flexibility analysis saved");
      await refresh();
    }
  }

  async function addCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCandidateBusy(true);
    const form = new FormData(event.currentTarget);
    const latitude = Number(form.get("latitude"));
    const longitude = Number(form.get("longitude"));
    const screenedOperator = screenGermanOperator(latitude, longitude);
    const maturity = calculateMaturity({
      projectKind: (site.project_kind || "other_large_consumer") as ProjectKind,
      latitude,
      longitude,
      requestedImportMw: site.requested_import_mw,
      minimumViableImportMw: site.minimum_viable_import_mw ?? 0,
      requestedExportMw: site.requested_export_mw,
      targetVoltageKv: number(form, "targetVoltageKv") || undefined,
      landStatus: String(form.get("landStatus") || "unknown") as SiteScreeningInput["landStatus"],
      planningStatus: String(
        form.get("planningStatus") || "unknown",
      ) as SiteScreeningInput["planningStatus"],
      singleLineDiagramReady: form.get("singleLineDiagramReady") === "on",
      cableRouteStatus: String(
        form.get("cableRouteStatus") || "unknown",
      ) as SiteScreeningInput["cableRouteStatus"],
      financeStatus: String(
        form.get("financeStatus") || "unknown",
      ) as SiteScreeningInput["financeStatus"],
    });
    const { error } = await supabase.from("project_site_candidates").insert({
      site_id: site.id,
      name: String(form.get("name") || "Alternative site"),
      latitude,
      longitude,
      municipality: String(form.get("municipality") || "") || null,
      federal_state: String(form.get("federalState") || "") || null,
      target_voltage_kv: number(form, "targetVoltageKv") || null,
      likely_tso: screenedOperator.transmissionOperator,
      maturity_score: maturity.score,
      screening_status: "public_context_only",
      infrastructure_context: {
        regionalContext: screenedOperator.regionalContext,
        maturityChecks: maturity.checks,
        maturityBlockers: maturity.blockers,
        limitation: "No available-capacity conclusion. Confirm with the responsible operator.",
      },
    });
    setCandidateBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Candidate site added to the comparison");
      event.currentTarget.reset();
      await refetchStrategyRecords();
    }
  }

  async function persistPackage(status: "draft" | "internal_review" | "approved" | "issued") {
    if ((status === "approved" || status === "issued") && !packageGate.ready) {
      toast.error("Resolve the package blockers before approval or issue.");
      return;
    }
    setBusy(true);
    const version = (packages[0]?.version ?? 0) + 1;
    const { error } = await supabase.from("operator_packages").insert({
      site_id: site.id,
      version,
      status,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      manifest: {
        evidenceCount: evidence.length,
        scenarioCount: scenarios.length,
        calculationVersion: result.calculationVersion,
        generatedAt: new Date().toISOString(),
      },
      methodology_version: "de-connection-options-v1",
      input_manifest: {
        profileId: profiles[0]?.id ?? null,
        profileVersion: profiles[0]?.version ?? null,
        profileHash: profiles[0]?.source_hash ?? null,
        scenarioIds: scenarios.map((scenario) => scenario.id),
        evidenceIds: evidence.map((item) => item.id),
      },
      issued_at: status === "issued" ? new Date().toISOString() : null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Package v${version} saved as ${status.replaceAll("_", " ")}`);
      await refetchStrategyRecords();
    }
  }

  async function saveDecision() {
    if (!preferredScenario) {
      toast.error("Select a preferred strategy first.");
      return;
    }
    const rationale = preferredScenario.selection_rationale?.trim();
    if (!rationale) {
      toast.error("The preferred strategy needs a recorded rationale.");
      return;
    }
    setBusy(true);
    const versions = await supabase
      .from("connection_decisions")
      .select("version")
      .eq("site_id", site.id)
      .order("version", { ascending: false })
      .limit(1);
    const decisionVersion = (versions.data?.[0]?.version ?? 0) + 1;
    const { data: decision, error } = await supabase
      .from("connection_decisions")
      .insert({
        site_id: site.id,
        scenario_id: preferredScenario.id,
        package_id: packages[0]?.id ?? null,
        version: decisionVersion,
        status: "draft",
        rationale,
        alternatives_rejected: scenarios
          .filter((item) => item.id !== preferredScenario.id)
          .map((item) => ({ id: item.id, name: item.name })),
        conditions_to_proceed: [
          "Written operator confirmation",
          "Technical study",
          "Commercial approval",
        ],
        assumptions: [
          "No available capacity is inferred",
          "All limits are declared or operator-supplied",
        ],
        evidence_ids: evidence.map((item) => item.id),
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      const actionTitles = [
        "Confirm responsible network operator",
        "Complete operator evidence checklist",
        "Submit operator engagement package",
        "Log operator response and requested studies",
        "Negotiate the flexible connection envelope",
      ];
      const now = Date.now();
      await supabase.from("assessment_milestones").insert(
        actionTitles.map((title, index) => ({
          site_id: site.id,
          user_id: site.user_id,
          title,
          milestone_type: "strategy_execution",
          status: "open",
          due_at: new Date(now + (index + 1) * 14 * 86_400_000).toISOString(),
          notes: `Generated from decision v${decisionVersion} (${decision.id}).`,
        })),
      );
      await supabase.from("assessment_activity").insert({
        site_id: site.id,
        actor_id: site.user_id,
        event_type: "decision_created",
        entity_type: "connection_decision",
        entity_id: decision.id,
        summary: `Decision v${decisionVersion} created for ${preferredScenario.name}`,
        details: { scenarioId: preferredScenario.id, packageId: packages[0]?.id ?? null },
      });
      toast.success("Decision saved and execution actions created");
      await refresh();
    }
  }

  async function savePilotSnapshot() {
    setBusy(true);
    const values = [
      [
        "evidence_completion",
        Math.round(
          (evidence.filter((item) => item.validation_status === "validated").length /
            Math.max(1, evidence.length)) *
            100,
        ),
        "percent",
      ],
      ["candidate_sites_compared", Math.max(1, candidates.length + 1), "sites"],
      ["connection_options_evaluated", decisionMatrix.length, "options"],
      [
        "operator_questions_open",
        decisionMatrix.reduce((sum, row) => sum + row.unresolvedGates, 0),
        "gates",
      ],
      ["modelled_annual_exposure", result.estimatedAnnualExposureEur, "EUR/year"],
    ] as const;
    const observedAt = new Date().toISOString();
    const { error } = await supabase.from("pilot_metrics").insert(
      values.map(([metric_key, metric_value, unit]) => ({
        site_id: site.id,
        metric_key,
        metric_value,
        unit,
        source: "calculated_snapshot",
        observed_at: observedAt,
        notes: "Phase 4 decision-workspace snapshot; operator validation remains controlling.",
      })),
    );
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Pilot outcome snapshot saved");
      await refetchStrategyRecords();
    }
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
    setBusy(true);
    const readinessScore = Math.round(
      (evidence.filter((item) => item.validation_status === "validated").length /
        Math.max(1, evidence.length)) *
        100,
    );
    const rows = [
      {
        name: "Requested firm",
        scenario_type: "requested_firm",
        connection_mode: "firm",
        max_import_mw: site.requested_import_mw,
        conditional_import_mw: 0,
        eventual_import_mw: site.requested_import_mw,
        firmness: "firm",
        restriction_schedule: null,
        dependencies: ["Operator study", "Firm-capacity confirmation"],
      },
      {
        name: "Reduced firm",
        scenario_type: "reduced_firm",
        connection_mode: "firm",
        max_import_mw: input.firmImportMw,
        conditional_import_mw: 0,
        eventual_import_mw: input.firmImportMw,
        firmness: "firm",
        restriction_schedule: null,
        dependencies: ["Operator study", "Customer acceptance of reduced initial capacity"],
      },
      {
        name: "Flexible envelope",
        scenario_type: "static_flexible",
        connection_mode: "static_fca",
        max_import_mw: input.firmImportMw,
        conditional_import_mw: input.conditionalImportMw,
        eventual_import_mw: site.requested_import_mw,
        firmness: "mixed",
        restriction_schedule: {
          kind: "recurring_candidate",
          timezone: "Europe/Berlin",
          weekdays: [1, 2, 3, 4, 5],
          startHour: 17,
          endHour: 19,
          modelledEventsPerYear: input.restrictionEventsPerYear,
          status: "customer_assumption",
        },
        dependencies: [
          "Written FCA under Section 17(2b) EnWG",
          "Operator control signal and metering specification",
          "Customer dispatch readiness",
        ],
      },
      {
        name: "Staged energisation",
        scenario_type: "staged_energisation",
        connection_mode: "staged",
        max_import_mw: input.firmImportMw,
        conditional_import_mw: 0,
        eventual_import_mw: site.requested_import_mw,
        firmness: "mixed",
        restriction_schedule: null,
        dependencies: [
          {
            milestone: "Initial energisation",
            importMw: input.firmImportMw,
            timing: "Operator-controlled",
          },
          {
            milestone: "Post-reinforcement envelope",
            importMw: site.requested_import_mw,
            timing: "After written reinforcement milestone",
          },
        ],
      },
    ].map((row) => ({
      ...row,
      site_id: site.id,
      user_id: site.user_id,
      max_export_mw: site.requested_export_mw,
      minimum_critical_load_mw: input.minimumCriticalLoadMw,
      outcome: "requires_operator_study",
      status: "draft",
      calculation_version: "strategy-comparison-v3",
      energy_value_eur_mwh: input.energyValueEurMwh,
      evidence_readiness: readinessScore,
      assumptions: { capacitySource: "customer_declared" },
      provenance: { evidenceClass: "customer_declared", operatorValidationRequired: true },
      unresolved_evidence: [
        "Operator-confirmed connection point",
        "Available firm and conditional capacity",
      ],
    }));
    const { error } = await supabase.from("connection_scenarios").insert(rows);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Standard strategy set created");
      await refresh();
    }
  }

  async function preferScenario(scenarioId: string) {
    const rationale = window.prompt("Why is this the preferred connection strategy?");
    if (!rationale?.trim()) return;
    setBusy(true);
    const clear = await supabase
      .from("connection_scenarios")
      .update({ selection_status: "candidate" })
      .eq("site_id", site.id)
      .eq("selection_status", "preferred");
    const select = clear.error
      ? clear
      : await supabase
          .from("connection_scenarios")
          .update({ selection_status: "preferred", selection_rationale: rationale.trim() })
          .eq("id", scenarioId);
    setBusy(false);
    if (select.error) toast.error(select.error.message);
    else {
      toast.success("Preferred strategy recorded");
      await refresh();
    }
  }

  async function duplicateScenario(scenario: Scenario) {
    setBusy(true);
    const { error } = await supabase.from("connection_scenarios").insert({
      site_id: site.id,
      user_id: site.user_id,
      name: `${scenario.name} copy`,
      connection_mode: scenario.connection_mode,
      scenario_type: scenario.scenario_type,
      max_import_mw: scenario.max_import_mw,
      conditional_import_mw: scenario.conditional_import_mw,
      eventual_import_mw: scenario.eventual_import_mw,
      max_export_mw: scenario.max_export_mw,
      minimum_critical_load_mw: scenario.minimum_critical_load_mw,
      firmness: scenario.firmness,
      outcome: scenario.outcome,
      assumptions: scenario.assumptions as never,
      enabling_assets: scenario.enabling_assets as never,
      dependencies: scenario.dependencies as never,
      unresolved_evidence: scenario.unresolved_evidence as never,
      provenance: scenario.provenance as never,
      evidence_readiness: scenario.evidence_readiness,
      energy_value_eur_mwh: scenario.energy_value_eur_mwh,
      calculation_version: scenario.calculation_version,
      restriction_schedule: scenario.restriction_schedule as never,
      status: "draft",
      selection_status: "candidate",
      supersedes_id: scenario.id,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Strategy duplicated as a new draft");
      await refresh();
    }
  }

  async function archiveScenario(scenario: Scenario) {
    if (scenario.selection_status === "preferred") {
      toast.error("Select another preferred strategy before archiving this one.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("connection_scenarios")
      .update({ status: "archived" })
      .eq("id", scenario.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Strategy archived");
      await refresh();
    }
  }

  async function runIntervalSimulation() {
    const profile = profiles[0];
    if (!profile) {
      toast.error("Upload a validated interval profile first.");
      return;
    }
    try {
      const analysis = simulateFlexibleConnection(profile.points, {
        firmImportMw: input.firmImportMw,
        conditionalImportMw: input.conditionalImportMw,
        minimumCriticalLoadMw: input.minimumCriticalLoadMw,
        shiftableLoadMw: input.shiftableLoadMw,
        batteryPowerMw: input.batteryPowerMw,
        batteryEnergyMwh: input.batteryEnergyMwh,
        batteryRoundTripEfficiency: input.batteryRoundTripEfficiency,
        batteryMinimumSoc: input.batteryMinimumSoc,
        initialBatterySoc: input.initialBatterySoc,
        energyValueEurMwh: input.energyValueEurMwh,
        batteryDegradationEurMwh: input.batteryDegradationEurMwh,
        minimumViableImportMw: site.minimum_viable_import_mw ?? input.minimumCriticalLoadMw,
      });
      setIntervalResult(analysis);
      const existing = await supabase
        .from("flexibility_simulations")
        .select("version")
        .eq("site_id", site.id)
        .eq("profile_id", profile.id)
        .order("version", { ascending: false })
        .limit(1);
      const { timeline, ...summary } = analysis;
      const { error } = await supabase.from("flexibility_simulations").insert({
        site_id: site.id,
        profile_id: profile.id,
        scenario_id: scenarios.find((item) => item.selection_status === "preferred")?.id ?? null,
        version: (existing.data?.[0]?.version ?? 0) + 1,
        settings: input,
        summary,
        timeline,
        calculation_version: analysis.calculationVersion,
        classification: analysis.classification,
        input_manifest: {
          profileId: profile.id,
          profileVersion: profile.version,
          profileHash: profile.source_hash,
          sourceClassification: profile.source_classification,
          scenarioId: scenarios.find((item) => item.selection_status === "preferred")?.id ?? null,
        },
      });
      if (error) toast.error(error.message);
      else toast.success("Versioned interval simulation saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to simulate profile");
    }
  }

  return (
    <section className="strategy-workbench">
      <header className="room-heading">
        <div>
          <p className="context-label">German connection strategy</p>
          <h2>From site screening to a package ready for operator review</h2>
          <p>
            Public context supports screening only. Capacity and dates remain operator-controlled.
          </p>
        </div>
        <span className="status warning-text">Planning model · not a connection offer</span>
      </header>
      <nav className="strategy-nav" aria-label="Connection strategy stages">
        {(["screen", "options", "flexibility", "deliver"] as const).map((item, index) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => setView(item)}
          >
            <span>0{index + 1}</span>
            {item === "deliver" ? "Package & memo" : item}
          </button>
        ))}
      </nav>

      {view === "screen" ? (
        <div className="strategy-grid">
          <article className="strategy-card map-card">
            <MapPin />
            <p className="context-label">Declared location</p>
            <h3>{site.municipality || site.name}</h3>
            <p>
              {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)} ·{" "}
              {site.federal_state || "Federal state not recorded"}
            </p>
            <div className="coordinate-map" aria-label="Location screening illustration">
              <span
                style={{
                  left: `${((site.longitude - 5) / 11) * 100}%`,
                  top: `${((56 - site.latitude) / 9) * 100}%`,
                }}
              />
            </div>
            <small>Geographic context only—this is not a capacity map.</small>
          </article>
          <article className="strategy-card">
            <p className="context-label">Likely transmission context</p>
            <h3>{operator.transmissionOperator}</h3>
            <p>{operator.regionalContext}</p>
            <dl className="strategy-facts">
              <div>
                <dt>Confidence</dt>
                <dd>Screening only</dd>
              </div>
              <div>
                <dt>Distribution operator</dt>
                <dd>Must be independently confirmed</dd>
              </div>
              <div>
                <dt>Target voltage</dt>
                <dd>{site.target_voltage_kv ? `${site.target_voltage_kv} kV` : "Not declared"}</dd>
              </div>
            </dl>
          </article>
          <article className="strategy-card">
            <p className="context-label">Project maturity</p>
            <strong className="strategy-score">{maturity.score}%</strong>
            <div className="maturity-list">
              {maturity.checks.map((check) => (
                <span key={check.key} className={check.ready ? "done" : ""}>
                  {check.ready ? <Check /> : <ShieldAlert />}
                  {check.key.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          </article>
          <article className="strategy-card candidate-comparison-card">
            <div className="candidate-card-heading">
              <div>
                <p className="context-label">Candidate comparison</p>
                <h3>Compare locations before committing to one queue</h3>
              </div>
              <small>Public-context screening only</small>
            </div>
            <form className="candidate-form" onSubmit={addCandidate}>
              <label>
                Candidate name
                <input name="name" required placeholder="e.g. Leipzig alternative" />
              </label>
              <label>
                Municipality
                <input name="municipality" placeholder="Leipzig" />
              </label>
              <label>
                Federal state
                <input name="federalState" placeholder="Saxony" />
              </label>
              <label>
                Latitude
                <input name="latitude" type="number" step="0.0001" min="47" max="56" required />
              </label>
              <label>
                Longitude
                <input name="longitude" type="number" step="0.0001" min="5" max="16" required />
              </label>
              <label>
                Target voltage (kV)
                <input name="targetVoltageKv" type="number" min="0" step="1" />
              </label>
              <label>
                Land status
                <select name="landStatus" defaultValue="unknown">
                  <option value="unknown">Unknown</option>
                  <option value="identified">Identified</option>
                  <option value="optioned">Optioned</option>
                  <option value="controlled">Controlled</option>
                </select>
              </label>
              <label>
                Planning status
                <select name="planningStatus" defaultValue="unknown">
                  <option value="unknown">Unknown</option>
                  <option value="not_started">Not started</option>
                  <option value="pre_application">Pre-application</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                </select>
              </label>
              <label>
                Cable route
                <select name="cableRouteStatus" defaultValue="unknown">
                  <option value="unknown">Unknown</option>
                  <option value="indicative">Indicative</option>
                  <option value="secured">Secured</option>
                </select>
              </label>
              <label>
                Financing
                <select name="financeStatus" defaultValue="unknown">
                  <option value="unknown">Unknown</option>
                  <option value="indicative">Indicative</option>
                  <option value="committed">Committed</option>
                </select>
              </label>
              <label className="candidate-checkbox">
                <input name="singleLineDiagramReady" type="checkbox" />
                Single-line diagram ready
              </label>
              <button type="submit" disabled={candidateBusy}>
                <MapPin /> Add candidate
              </button>
            </form>
            {candidates.length ? (
              <div className="candidate-table" role="table" aria-label="Candidate site comparison">
                <div className="candidate-row candidate-header" role="row">
                  <span>Site</span>
                  <span>Likely TSO</span>
                  <span>Voltage</span>
                  <span>Maturity</span>
                  <span>Decision factors</span>
                  <span>Status</span>
                </div>
                {candidates.map((candidate) => {
                  const dimensions = assessCandidateDimensions(candidate, profiles.length > 0);
                  return (
                    <div className="candidate-row" role="row" key={candidate.id}>
                      <span>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.municipality || "Location declared"}</small>
                      </span>
                      <span>{candidate.likely_tso || "Unscreened"}</span>
                      <span>
                        {candidate.target_voltage_kv ? `${candidate.target_voltage_kv} kV` : "Open"}
                      </span>
                      <span>
                        <strong>{candidate.maturity_score}%</strong>
                        <small>{candidateMaturitySummary(candidate)}</small>
                      </span>
                      <span>
                        <strong>Evidence {dimensions.evidenceCompleteness}%</strong>
                        <small>
                          Operator {dimensions.operatorReadiness}% · Fit{" "}
                          {dimensions.operationalFit.replaceAll("_", " ")}
                        </small>
                        <small>Next: {dimensions.nextAction}</small>
                      </span>
                      <span>{candidate.screening_status.replaceAll("_", " ")}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty-strategy-state">No alternative candidate sites recorded yet.</p>
            )}
          </article>
        </div>
      ) : view === "options" ? (
        <div className="strategy-card comparison-workspace">
          <div className="candidate-card-heading">
            <div>
              <p className="context-label">Connection strategy comparison</p>
              <h3>Compare the credible routes before operator engagement</h3>
            </div>
            {!activeScenarios.length ? (
              <button onClick={createStandardScenarios} disabled={busy}>
                Create standard strategies
              </button>
            ) : null}
          </div>
          <div className="option-result-grid" aria-label="Modelled connection option results">
            {liveOptions.map((option) => (
              <article
                className={`option-result-card ${option.operationalStatus}`}
                key={option.kind}
              >
                <div>
                  <p className="context-label">{option.evidenceStatus.replaceAll("_", " ")}</p>
                  <h4>{option.title}</h4>
                </div>
                <strong>{option.operationalStatus.replaceAll("_", " ")}</strong>
                <dl>
                  <div>
                    <dt>Initial</dt>
                    <dd>{option.initialImportMw.toFixed(1)} MW</dd>
                  </div>
                  <div>
                    <dt>Eventual</dt>
                    <dd>{option.eventualImportMw.toFixed(1)} MW</dd>
                  </div>
                  <div>
                    <dt>Restricted</dt>
                    <dd>
                      {option.analysis
                        ? `${option.analysis.restrictedHours} h`
                        : "Profile required"}
                    </dd>
                  </div>
                  <div>
                    <dt>Residual</dt>
                    <dd>
                      {option.analysis
                        ? `${option.analysis.residualUnservedMwh} MWh`
                        : "Not tested"}
                    </dd>
                  </div>
                </dl>
                <details>
                  <summary>Commitments and operator questions</summary>
                  <b>Customer commitments</b>
                  <ul>
                    {option.customerCommitments.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <b>Questions for the operator</b>
                  <ul>
                    {option.operatorQuestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
          <div
            className="strategy-comparison-table"
            role="table"
            aria-label="Connection strategy comparison"
          >
            <div className="comparison-row comparison-header">
              <span>Strategy</span>
              <span>Initial</span>
              <span>Conditional</span>
              <span>Eventual</span>
              <span>Firmness</span>
              <span>Evidence</span>
              <span>Decision</span>
            </div>
            {activeScenarios.length
              ? activeScenarios.map((scenario) => (
                  <div
                    className={`comparison-row ${scenario.selection_status === "preferred" ? "preferred" : ""}`}
                    key={scenario.id}
                  >
                    <span>
                      <strong>{scenario.name}</strong>
                      <small>{strategyPathSummary(scenario)}</small>
                    </span>
                    <span>{scenario.max_import_mw ?? "Open"} MW</span>
                    <span>{scenario.conditional_import_mw || 0} MW</span>
                    <span>
                      {scenario.eventual_import_mw ?? scenario.max_import_mw ?? "Open"} MW
                    </span>
                    <span>{scenario.firmness || "Unspecified"}</span>
                    <span>{scenario.evidence_readiness || 0}%</span>
                    <span>
                      {scenario.selection_status === "preferred" ? (
                        <b>Preferred</b>
                      ) : (
                        <button onClick={() => preferScenario(scenario.id)} disabled={busy}>
                          Select
                        </button>
                      )}
                      <button onClick={() => duplicateScenario(scenario)} disabled={busy}>
                        Duplicate
                      </button>
                      <button onClick={() => archiveScenario(scenario)} disabled={busy}>
                        Archive
                      </button>
                    </span>
                  </div>
                ))
              : suggestedScenarios.map(([name, capacity, note]) => (
                  <div className="comparison-row" key={String(name)}>
                    <span>
                      <strong>{name}</strong>
                      <small>{note}</small>
                    </span>
                    <span>{Number(capacity).toFixed(1)} MW</span>
                    <span>Draft</span>
                    <span>Draft</span>
                    <span>Indicative</span>
                    <span>0%</span>
                    <span>Not saved</span>
                  </div>
                ))}
          </div>
          <div className="decision-matrix" role="table" aria-label="Evidence-gated decision matrix">
            <div className="decision-matrix-row decision-matrix-header" role="row">
              <span>Route</span>
              <span>Evidence</span>
              <span>Operational fit</span>
              <span>Exposure</span>
              <span>Next controlled action</span>
            </div>
            {decisionMatrix.map((row) => (
              <div className="decision-matrix-row" role="row" key={row.kind}>
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.recommendation.replaceAll("_", " ")}</small>
                </span>
                <span>
                  {row.evidenceReadiness}%<small>{row.unresolvedGates} unresolved gates</small>
                </span>
                <span>{row.operationalStatus.replaceAll("_", " ")}</span>
                <span>
                  {row.annualExposureEur === null
                    ? "Profile required"
                    : `€${row.annualExposureEur.toLocaleString("en-GB")}/yr`}
                  {row.exposureSensitivity.status === "modelled" ? (
                    <small>
                      Range €{row.exposureSensitivity.lowExposureEur?.toLocaleString("en-GB")}–€
                      {row.exposureSensitivity.highExposureEur?.toLocaleString("en-GB")}
                    </small>
                  ) : null}
                </span>
                <span>{row.nextAction}</span>
              </div>
            ))}
          </div>
          <p className="model-warning">
            <Info />
            All limits are customer-declared or operator-supplied. GridPulse does not infer
            available capacity.
          </p>
        </div>
      ) : view === "flexibility" ? (
        <div className="flexibility-layout">
          <form className="strategy-form" onSubmit={analyse}>
            <h3>Declared operating envelope</h3>
            {[
              ["requestedImportMw", "Requested import", input.requestedImportMw],
              ["firmImportMw", "Firm import", input.firmImportMw],
              ["conditionalImportMw", "Conditional additional import", input.conditionalImportMw],
              ["minimumCriticalLoadMw", "Minimum critical load", input.minimumCriticalLoadMw],
              ["shiftableLoadMw", "Shiftable workload", input.shiftableLoadMw],
              ["batteryPowerMw", "Battery power", input.batteryPowerMw],
              ["batteryEnergyMwh", "Battery energy (MWh)", input.batteryEnergyMwh],
              [
                "restrictionDurationHours",
                "Restriction duration (hours)",
                input.restrictionDurationHours,
              ],
              ["restrictionEventsPerYear", "Events per year", input.restrictionEventsPerYear],
              ["maximumEventsPerDay", "Maximum events per day", input.maximumEventsPerDay],
              ["recoveryHours", "Recovery between events (hours)", input.recoveryHours],
              ["geographicTransferMw", "Transferable workload", input.geographicTransferMw],
              [
                "notificationLeadMinutes",
                "Notification lead (minutes)",
                input.notificationLeadMinutes,
              ],
              ["rampDownMwPerMinute", "Ramp-down rate (MW/min)", input.rampDownMwPerMinute],
              ["rampUpMwPerMinute", "Ramp-up rate (MW/min)", input.rampUpMwPerMinute],
              ["upsPowerMw", "UPS power", input.upsPowerMw],
              ["upsEnergyMwh", "UPS energy (MWh)", input.upsEnergyMwh],
              ["generatorPowerMw", "Generator power", input.generatorPowerMw],
              [
                "generatorMaxHoursYear",
                "Generator maximum hours/year",
                input.generatorMaxHoursYear,
              ],
              [
                "batteryRoundTripEfficiency",
                "Battery efficiency (0–1)",
                input.batteryRoundTripEfficiency,
              ],
              ["batteryMinimumSoc", "Battery minimum SOC (0–1)", input.batteryMinimumSoc],
              ["initialBatterySoc", "Initial battery SOC (0–1)", input.initialBatterySoc],
              ["energyValueEurMwh", "Unserved-energy value (EUR/MWh)", input.energyValueEurMwh],
              [
                "batteryDegradationEurMwh",
                "Battery degradation (EUR/MWh)",
                input.batteryDegradationEurMwh,
              ],
            ].map(([name, label, value]) => (
              <label key={String(name)}>
                {label}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  name={String(name)}
                  defaultValue={Number(value)}
                />
              </label>
            ))}
            <button className="primary-button" type="submit">
              <Zap /> Recalculate envelope
            </button>
          </form>
          <article className="strategy-card result-card">
            <p className="context-label">Deterministic result · {result.calculationVersion}</p>
            <h3>
              {result.compatible ? "Compatible on declared inputs" : "Envelope leaves a shortfall"}
            </h3>
            <dl className="strategy-facts">
              <div>
                <dt>Gross shortfall</dt>
                <dd>{result.grossShortfallMw} MW</dd>
              </div>
              <div>
                <dt>Workload contribution</dt>
                <dd>{result.shiftableContributionMw} MW</dd>
              </div>
              <div>
                <dt>Battery contribution</dt>
                <dd>{result.batteryContributionMw} MW</dd>
              </div>
              <div>
                <dt>Residual shortfall</dt>
                <dd>{result.residualShortfallMw} MW</dd>
              </div>
              <div>
                <dt>Annual constrained energy</dt>
                <dd>{result.annualConstrainedEnergyMwh} MWh</dd>
              </div>
              <div>
                <dt>Modelled annual exposure</dt>
                <dd>€{result.estimatedAnnualExposureEur.toLocaleString("en-GB")}</dd>
              </div>
              <div>
                <dt>Dispatchable resources</dt>
                <dd>{specificationValidation.derived.dispatchablePowerMw} MW</dd>
              </div>
              <div>
                <dt>Usable battery duration</dt>
                <dd>{specificationValidation.derived.batteryDurationHours} h</dd>
              </div>
            </dl>
            {specificationValidation.blockers.map((blocker) => (
              <p className="model-warning" key={blocker}>
                <ShieldAlert />
                Blocking inconsistency: {blocker}
              </p>
            ))}
            {specificationValidation.warnings.map((warning) => (
              <p className="model-warning" key={warning}>
                <Info />
                {warning}
              </p>
            ))}
            {result.warnings.map((warning) => (
              <p className="model-warning" key={warning}>
                <Info />
                {warning}
              </p>
            ))}
            <button
              onClick={saveFlexibility}
              disabled={busy || specificationValidation.blockers.length > 0}
            >
              Save analysis
            </button>
            <button onClick={runIntervalSimulation} disabled={busy || !profiles.length}>
              <Zap /> Run 15-minute profile simulation
            </button>
            {intervalResult ? (
              <div className="interval-result">
                <p className="context-label">
                  Interval result · {intervalResult.calculationVersion}
                </p>
                <div className="interval-metrics">
                  <span>
                    <b>{intervalResult.demandServedPercent}%</b> demand served
                  </span>
                  <span>
                    <b>{intervalResult.restrictedHours} h</b> restricted
                  </span>
                  <span>
                    <b>{intervalResult.residualUnservedMwh} MWh</b> residual
                  </span>
                  <span>
                    <b>€{intervalResult.estimatedAnnualExposureEur.toLocaleString("en-GB")}</b>{" "}
                    exposure
                  </span>
                </div>
                <div className="dispatch-chart" aria-label="Recent interval dispatch result">
                  {intervalResult.timeline.slice(0, 96).map((point) => (
                    <i
                      key={point.timestamp}
                      style={{
                        height: `${Math.min(100, point.baselineImportMw ? (point.residualShortfallMw / point.baselineImportMw) * 100 : 0)}%`,
                      }}
                      title={`${point.timestamp}: ${point.residualShortfallMw} MW residual`}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </div>
      ) : (
        <div className="strategy-grid deliverables-grid">
          <CommercialDecisionGate
            site={site}
            preferredOption={preferredOption}
            estimatedConnectionCostEur={
              strategyRecords?.engagement?.estimated_connection_cost_eur ?? null
            }
            indicatedConnectionDate={strategyRecords?.engagement?.indicated_connection_date ?? null}
          />
          <article className="strategy-card">
            <p className="context-label">Operator engagement package</p>
            <h3>{packageGate.ready ? "Ready to issue" : "Draft blocked"}</h3>
            {packageGate.blockers.map((blocker) => (
              <p className="model-warning" key={blocker}>
                <ShieldAlert />
                {blocker}
              </p>
            ))}
            <p>
              Structured project requirements, evidence register, scenarios, FCA result and operator
              questions.
            </p>
            <div className="package-actions">
              <button onClick={() => persistPackage("draft")} disabled={busy}>
                Save controlled draft
              </button>
              <button onClick={() => persistPackage("internal_review")} disabled={busy}>
                Send to internal review
              </button>
              <button
                onClick={() => persistPackage("approved")}
                disabled={busy || !packageGate.ready}
              >
                Approve package
              </button>
              <button
                onClick={() => persistPackage("issued")}
                disabled={busy || !packageGate.ready}
              >
                Issue next version
              </button>
              <button onClick={() => downloadJson(`${site.name}-operator-package.json`, snapshot)}>
                <Download /> Download snapshot
              </button>
              <button
                onClick={() =>
                  downloadOperatorPackagePdf(snapshot, {
                    version: (packages[0]?.version ?? 0) + 1,
                    status: packageGate.ready ? "review draft" : "blocked draft",
                    preferredStrategy: preferredScenario?.name,
                    rationale: preferredScenario?.selection_rationale ?? undefined,
                  })
                }
              >
                <Download /> Download A4 PDF
              </button>
            </div>
            {packages.length ? (
              <div className="package-history">
                {packages.slice(0, 5).map((item) => (
                  <span key={item.id}>
                    v{item.version} · {item.status} ·{" "}
                    {new Date(item.created_at).toLocaleDateString("en-GB")}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
          <article className="strategy-card">
            <p className="context-label">Traceable decision memo</p>
            <h3>{result.compatible ? "Proceed to operator study" : "Revise the strategy"}</h3>
            <p>
              Records the recommendation, reasons, limitations, evidence register and next actions.
            </p>
            <button
              onClick={() =>
                downloadJson(`${site.name}-decision-memo.json`, buildDecisionMemo(snapshot))
              }
            >
              <Download /> Download decision memo
            </button>
            <button onClick={saveDecision} disabled={busy || !preferredScenario}>
              Save versioned decision record
            </button>
          </article>
          <article className="strategy-card pilot-outcomes-card">
            <p className="context-label">Pilot outcome measurement</p>
            <h3>Prove process value without claiming grid capacity</h3>
            <dl className="strategy-facts">
              <div>
                <dt>Evidence completion</dt>
                <dd>
                  {Math.round(
                    (evidence.filter((item) => item.validation_status === "validated").length /
                      Math.max(1, evidence.length)) *
                      100,
                  )}
                  %
                </dd>
              </div>
              <div>
                <dt>Sites compared</dt>
                <dd>{Math.max(1, candidates.length + 1)}</dd>
              </div>
              <div>
                <dt>Options evaluated</dt>
                <dd>{decisionMatrix.length}</dd>
              </div>
              <div>
                <dt>Snapshots recorded</dt>
                <dd>{new Set(metrics.map((item) => item.observed_at)).size}</dd>
              </div>
            </dl>
            <p>
              Use repeated snapshots to show fewer evidence gaps, fewer unresolved operator
              questions and faster package preparation during a German pilot.
            </p>
            <button onClick={savePilotSnapshot} disabled={busy}>
              Save outcome snapshot
            </button>
          </article>
        </div>
      )}
    </section>
  );
}

function candidateMaturitySummary(candidate: ProjectSiteCandidate) {
  const context = candidate.infrastructure_context as {
    maturityChecks?: Array<{ key: string; ready: boolean }>;
  };
  const checks = context.maturityChecks ?? [];
  if (!checks.length) return "Legacy manual score";
  return `${checks.filter((check) => check.ready).length}/${checks.length} evidenced gates`;
}
