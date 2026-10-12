import { supabase } from "@/integrations/supabase/client";
import type { PreferredStrategyRepository } from "./prefer-strategy";
export const preferredStrategyRepository: PreferredStrategyRepository = {
  async selectPreferred(siteId, scenarioId, rationale) {
    const { error } = await supabase.rpc("gridpulse_prefer_strategy", {
      p_site_id: siteId,
      p_scenario_id: scenarioId,
      p_rationale: rationale,
    });
    if (error) throw new Error(error.message);
  },
};
