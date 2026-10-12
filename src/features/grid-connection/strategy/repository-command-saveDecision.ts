import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import type { DecisionRepository } from "./record-decision";

export const decisionRepository: DecisionRepository = {
  async recordDecision(siteId, decision, actions, activity) {
    const { data, error } = await supabase.rpc("gridpulse_record_strategy_decision", {
      p_site_id: siteId,
      p_decision: decision,
      p_actions: actions,
      p_activity: activity,
    });
    if (error) throw new Error(error.message);
    return z.object({ id: z.string().uuid(), version: z.number().int().positive() }).parse(data);
  },
};
