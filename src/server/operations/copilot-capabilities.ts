import { intents } from "../../features/operations/copilot/conversation-contracts";

/** One advertised capability inventory for the existing bounded query executor. */
export function copilotCapabilities(hasExperiment: boolean) {
  return intents.map(intent => ({ intent,
    execution: intent === "what_if" ? "review_and_confirm_separate_job" : intent === "accounting" ? "review_tariff_then_existing_job_api" :
      intent === "experiment" ? "owned_completed_experiment_only" : "read_only",
    available: intent !== "experiment" || hasExperiment,
    limitations: intent === "why" ? "Causal solver preference is not supplied" : intent === "knowledge" ? "Reviewed general guidance, not site verification" :
      intent === "accounting" ? "Private-service energy-only accounting; no full retail bill" : "Submitted model evidence only",
  }));
}
