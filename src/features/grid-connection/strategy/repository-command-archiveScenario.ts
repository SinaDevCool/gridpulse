import { supabase } from "@/integrations/supabase/client";
import type { Scenario } from "@/lib/assessment-model";
export function updateScenario(scenario: Scenario) {
  return supabase.from("connection_scenarios").update({ status: "archived" }).eq("id", scenario.id);
}
