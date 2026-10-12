import { supabase } from "@/integrations/supabase/client";
import type { Scenario } from "@/lib/assessment-model";
export function updateConnectionScenarios1(scenario: Scenario) {
  return supabase.from("connection_scenarios").update({ status: "archived" }).eq("id", scenario.id);
}
