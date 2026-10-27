import { intents } from "../../features/operations/copilot/conversation-contracts";

/** One advertised capability inventory for the existing bounded query executor. */
export function copilotCapabilities(hasExperiment: boolean, access: { experiments?: boolean; accounting?: boolean } = {}) {
  return intents.map(intent => ({ intent,
    execution: intent === "what_if" ? "review_and_confirm_separate_job" : intent === "accounting" ? "review_tariff_then_existing_job_api" :
      intent === "experiment" ? "owned_completed_experiment_only" : "read_only",
    available: intent === "experiment" ? hasExperiment : intent === "what_if" ? !!access.experiments : intent === "accounting" ? !!access.accounting : intent !== "unsupported" && intent !== "why",
    unavailableReason: intent === "experiment" && !hasExperiment ? "Attach a completed experiment for this plan." :
      intent === "what_if" && !access.experiments ? "Exact-baseline experiments are not enabled for this service." :
      intent === "accounting" && !access.accounting ? "Private energy accounting is not enabled for this service." :
      intent === "why" ? "The result does not establish causal solver preference." : intent === "unsupported" ? "Outside the read-only modelled assessment." : null,
    limitations: intent === "why" ? "Causal solver preference is not supplied" : intent === "knowledge" ? "Reviewed general guidance, not site verification" :
      intent === "accounting" ? "Private-service energy-only accounting; no full retail bill" : "Submitted model evidence only",
  }));
}
