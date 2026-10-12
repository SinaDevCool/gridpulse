import { supabase } from "@/integrations/supabase/client";
export function insertConnectionScenarios1(
  rows: (
    | {
        site_id: string;
        user_id: string;
        max_export_mw: number;
        minimum_critical_load_mw: number;
        outcome: string;
        status: string;
        calculation_version: string;
        energy_value_eur_mwh: number;
        evidence_readiness: number;
        assumptions: { capacitySource: string };
        provenance: { evidenceClass: string; operatorValidationRequired: boolean };
        unresolved_evidence: string[];
        name: string;
        scenario_type: string;
        connection_mode: string;
        max_import_mw: number;
        conditional_import_mw: number;
        eventual_import_mw: number;
        firmness: string;
        restriction_schedule: null;
        dependencies: string[];
      }
    | {
        site_id: string;
        user_id: string;
        max_export_mw: number;
        minimum_critical_load_mw: number;
        outcome: string;
        status: string;
        calculation_version: string;
        energy_value_eur_mwh: number;
        evidence_readiness: number;
        assumptions: { capacitySource: string };
        provenance: { evidenceClass: string; operatorValidationRequired: boolean };
        unresolved_evidence: string[];
        name: string;
        scenario_type: string;
        connection_mode: string;
        max_import_mw: number;
        conditional_import_mw: number;
        eventual_import_mw: number;
        firmness: string;
        restriction_schedule: {
          kind: string;
          timezone: string;
          weekdays: number[];
          startHour: number;
          endHour: number;
          modelledEventsPerYear: number;
          status: string;
        };
        dependencies: string[];
      }
    | {
        site_id: string;
        user_id: string;
        max_export_mw: number;
        minimum_critical_load_mw: number;
        outcome: string;
        status: string;
        calculation_version: string;
        energy_value_eur_mwh: number;
        evidence_readiness: number;
        assumptions: { capacitySource: string };
        provenance: { evidenceClass: string; operatorValidationRequired: boolean };
        unresolved_evidence: string[];
        name: string;
        scenario_type: string;
        connection_mode: string;
        max_import_mw: number;
        conditional_import_mw: number;
        eventual_import_mw: number;
        firmness: string;
        restriction_schedule: null;
        dependencies: { milestone: string; importMw: number; timing: string }[];
      }
  )[],
) {
  return supabase.from("connection_scenarios").insert(rows);
}
