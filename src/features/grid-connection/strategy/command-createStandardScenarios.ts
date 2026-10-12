import { toast } from "sonner";
import * as strategyQueries from "./repository-command-createStandardScenarios";
import type { StrategyControllerContract } from "./controller-contract";
type Context = Pick<
  StrategyControllerContract,
  "site" | "evidence" | "refresh" | "setBusy" | "input"
>;
export async function execute(context: Context): Promise<void> {
  const { site, evidence, refresh, setBusy, input } = context;
  setBusy(true);
  try {
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
    const { error } = await strategyQueries.saveConnectionScenarios(rows);
    if (error) toast.error(error.message);
    else {
      toast.success("Standard strategy set created");
      await refresh();
    }
    return;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "The command failed.");
  } finally {
    setBusy(false);
  }
}
