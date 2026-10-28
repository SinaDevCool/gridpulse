import type { CanonicalPresentation } from "../canonical-presentation";
import type { ConversationQuery } from "./conversation-contracts";
/** Application-owned recipes. Model outputs cannot create actions or permissions. */
export function investigationFor(
  a: CanonicalPresentation,
  queries: ConversationQuery[],
) {
  const battery = !!a.request.batteries?.length;
  const workloads = queries.some(
    (q) => q.intent === "workload" || q.intent === "workloads" || q.workloadId,
  );
  const diagnosis = queries.some((q) => q.intent === "diagnosis");
  const gaps = [
    {
      id: "metering",
      scope: "facility",
      status: "unknown" as const,
      reason: "PCC and IT meter boundaries, timestamps, units and completeness",
      actionId: "review_measurements",
      question: "Which measurements are missing before live use?",
    },
    ...(battery
      ? [
          {
            id: "battery",
            scope: "battery",
            status: "unknown" as const,
            reason:
              "Battery measured usable capacity, SOC, efficiencies and reserve policy",
            actionId: "review_battery",
            question: "When is battery reserve lowest?",
          },
        ]
      : []),
    ...(workloads || diagnosis
      ? [
          {
            id: "scheduler",
            scope: "workload",
            status: "unknown" as const,
            reason: "Scheduler runtime, deadlines and interruption permissions",
            actionId: "review_workloads",
            question: "Which workload restrictions apply?",
          },
        ]
      : []),
    ...(!workloads
      ? [
          {
            id: "cooling",
            scope: "facility",
            status: "unknown" as const,
            reason:
              "Cooling topology, load/temperature operating range and electrical limits",
            actionId: "review_measurements",
            question: "What are the limitations of the cooling model?",
          },
        ]
      : []),
  ];
  return {
    status: "requires_independent_validation" as const,
    gaps,
    hypotheses: diagnosis
      ? [
          ...(battery
            ? [
                {
                  label: "Battery capability or reserve may restrict response",
                  status: "untested" as const,
                  test: "Inspect submitted SOC, reserve, terminal target and outage intervals; review a separate power/energy/availability experiment.",
                },
              ]
            : []),
          {
            label:
              "Workload restrictions or cooling recovery may restrict shifting",
            status: "untested" as const,
            test: "Review the selected workload permissions and recovery checks before a separate comparison.",
          },
        ]
      : [],
    requiredEvidence: gaps.map((g) => g.reason),
    nextAction:
      "Review the scoped evidence gaps. Confirm any separate calculation with exact inputs; retain the accepted baseline. No dispatch is authorised.",
  };
}
