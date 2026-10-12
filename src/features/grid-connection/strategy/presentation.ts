import type { ProjectSiteCandidate,Scenario } from "@/lib/assessment-model";

export const number = (form: FormData, key: string) => Math.max(0, Number(form.get(key)) || 0);

export function strategyPathSummary(scenario: Scenario) {
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

export function optionKindForScenario(scenario: Scenario) {
  return scenario.scenario_type === "staged_energisation" ? "staged" : scenario.scenario_type;
}

export function candidateMaturitySummary(candidate: ProjectSiteCandidate) {
  const context = candidate.infrastructure_context as {
    maturityChecks?: Array<{ key: string; ready: boolean }>;
  };
  const checks = context.maturityChecks ?? [];
  if (!checks.length) return "Legacy manual score";
  return `${checks.filter((check) => check.ready).length}/${checks.length} evidenced gates`;
}
