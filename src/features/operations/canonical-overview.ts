import type { CanonicalPresentation } from "./canonical-presentation";
import type { PowerBalanceStep } from "./overview/SignedResponseDiagram";
import { selectBreachSpans } from "./overview/select-breach-spans";
import type { OverviewImpact } from "./overview/overview-presentation";
import { formatPercent } from "./formatting";

/** Presentation arithmetic only. No scheduling, optimisation or feasibility inference. */
export function canonicalPowerBalance(a: CanonicalPresentation, index: number) {
  const baseline = a.projected.overview.baseline[index];
  const planned = a.projected.overview.power[index];
  const steps: PowerBalanceStep[] = [{ label: "Baseline import", start: 0,
    end: baseline.grid_import_mw, value: baseline.grid_import_mw, total: true }];
  let running = baseline.grid_import_mw;
  const add = (label: string, value: number) => {
    steps.push({ label, start: running, end: running + value, value, total: false });
    running += value;
  };
  const fields = [["IT change", "it_power_mw", 1], ["Cooling change", "cooling_power_mw", 1],
    ["Auxiliary change", "auxiliary_power_mw", 1], ["Loss change", "losses_mw", 1],
    ["Generation change", "onsite_generation_mw", -1]] as const;
  for (const [label, key, sign] of fields) {
    const before = baseline[key], after = planned[key];
    if (typeof before !== "number" || !Number.isFinite(before) ||
        typeof after !== "number" || !Number.isFinite(after)) return null;
    const delta = sign * (after - before);
    if (Math.abs(delta) > 1e-8) add(label, delta);
  }
  // Baseline can include battery flows; subtract those before adding planned flows.
  add("Battery change", planned.battery_charge_mw - planned.battery_discharge_mw -
    baseline.battery_charge_mw + baseline.battery_discharge_mw);
  const net = (point: typeof planned) => Number(point.it_power_mw) + Number(point.cooling_power_mw) +
    Number(point.auxiliary_power_mw) + Number(point.losses_mw) - Number(point.onsite_generation_mw) +
    point.battery_charge_mw - point.battery_discharge_mw;
  const clipping = Math.max(0, -net(planned)) - Math.max(0, -net(baseline));
  if (Math.abs(clipping) > 1e-8) add("Export clipping", clipping);
  steps.push({ label: "Grid import", start: 0, end: planned.grid_import_mw,
    value: planned.grid_import_mw, total: true });
  return { steps, reconstructed: running, actual: planned.grid_import_mw };
}

export function canonicalBreachMinutes(a: CanonicalPresentation, baseline: boolean) {
  return selectBreachSpans(a.points, baseline ? "baselineDemandMw" : "gridImportMw", point => point.limitMw + .01)
    .reduce((sum, span) => sum + span.minutes, 0);
}

export function canonicalAssessmentFacts(a: CanonicalPresentation) {
  const result = a.projected.assessment;
  const flag = (key: string) => typeof result[key] === "boolean" ? result[key] as boolean : null;
  const count = (key: string) => typeof result[key] === "number" && Number.isFinite(result[key]) ? result[key] as number : null;
  return { recoveryComplete: flag("recovery_complete"), terminalTargetsMet: flag("battery_terminal_targets_met"),
    slaViolations: Array.isArray(result.sla_violations) ? result.sla_violations.length : null,
    importViolations: count("import_limit_violations") };
}

export function canonicalImpact(a: CanonicalPresentation): OverviewImpact {
  const start = Date.parse(a.points[0].timestamp);
  return { baselinePeakMw: a.baselinePeakMw, planPeakMw: a.planPeakMw, limitMw: a.limitMw,
    scope: "full_horizon", start, durationMs: Date.parse(a.points.at(-1)!.endTimestamp!) - start,
    lanes: [true, false].map(baseline => ({ label: baseline ? "Before response" : "Joint plan",
      minutes: canonicalBreachMinutes(a, baseline),
      spans: selectBreachSpans(a.points, baseline ? "baselineDemandMw" : "gridImportMw", point => point.limitMw + .01) })),
  };
}

export type CanonicalCheck = { id: string; label: string; value: string;
  state: "passed" | "failed" | "unavailable" | "not_applicable" };
export function canonicalChecks(a: CanonicalPresentation): CanonicalCheck[] {
  const facts = canonicalAssessmentFacts(a);
  const flag = (id: string, label: string, value: boolean | null): CanonicalCheck => ({ id, label,
    value: value === null ? "Unavailable" : value ? "Passed within model" : "Unresolved",
    state: value === null ? "unavailable" : value ? "passed" : "failed" });
  const count = (id: string, label: string, value: number | null): CanonicalCheck => ({ id, label,
    value: value === null ? "Unavailable" : String(value), state: value === null ? "unavailable" : value === 0 ? "passed" : "failed" });
  return [flag("completion", "Recovery & completion", facts.recoveryComplete),
    count("sla", "SLA violations", facts.slaViolations), count("import", "Import-limit violations", facts.importViolations),
    a.batteryAudit ? flag("terminal", "Battery terminal target", facts.terminalTargetsMet) :
      { id: "terminal", label: "Battery terminal target", value: "Not applicable", state: "not_applicable" },
    a.batteryAudit ? { id: "soc", label: "Minimum modelled SOC", state: "passed",
      value: formatPercent(Math.min(a.batteryAudit.initialSocPercent, ...a.points.map(point => point.socPercent!))) } :
      { id: "soc", label: "Minimum modelled SOC", value: "No battery", state: "not_applicable" },
  ];
}

/** Check outcomes stay separate from the SOC measurement; neither is a confidence score. */
export function canonicalCheckSummary(a: CanonicalPresentation) {
  const all = canonicalChecks(a);
  const checks = all.filter(check => check.id !== "soc").map(check => {
    if (check.id === "sla") {
      const missing = a.jobs.filter(job => job.deadlineMet === undefined).length;
      const missed = a.jobs.filter(job => job.deadlineMet === false).length;
      if (missing || missed) return { ...check,
        state: check.state === "failed" || missed ? "failed" as const : "unavailable" as const,
        value: [check.value === "Unavailable" ? "Declared SLA check unavailable" : `${check.value} declared SLA violations`,
          ...(missed ? [`${missed} deadlines not met`] : []), ...(missing ? [`${missing} deadline checks unavailable`] : [])].join(" · ") };
    }
    if (check.id === "completion") {
      const remaining = a.jobs.map(job => job.endingRemainingWorkHours ?? job.points.at(-1)?.remaining_work_hours);
      if (remaining.some(value => value === undefined)) return { ...check,
        state: check.state === "failed" ? "failed" as const : "unavailable" as const, value: "Workload completion evidence unavailable" };
      if (remaining.some(value => value! > 1e-6)) return { ...check, state: "failed" as const, value: "Work remains at horizon end" };
    }
    return check;
  });
  const failed = checks.filter(check => check.state === "failed");
  const unavailable = checks.filter(check => check.state === "unavailable");
  return { checks, measurement: all.find(check => check.id === "soc")!, failed, unavailable,
    label: failed.length ? "Review required" : unavailable.length ? "Some checks unavailable" : "No unresolved checks",
    state: failed.length ? "failed" : unavailable.length ? "unavailable" : "passed" };
}

export function canonicalMargins(a: CanonicalPresentation, index: number) {
  return [
    { id: "peak", label: a.request.facility.import_limit_profile_mw ? "Tightest whole-plan margin" : "Whole-plan peak", safety: a.request.policy.operating_target_profile_mw ? Math.min(...a.points.map(p => p.targetMw - p.gridImportMw)) : a.targetMw - a.planPeakMw, facility: a.request.facility.import_limit_profile_mw ? Math.min(...a.points.map(p => p.limitMw - p.gridImportMw)) : a.limitMw - a.planPeakMw },
    { id: "interval", label: "Inspected interval", safety: a.points[index].targetMw - a.points[index].gridImportMw, facility: a.points[index].limitMw - a.points[index].gridImportMw },
  ];
}
