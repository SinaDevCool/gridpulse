import type { CanonicalPresentation } from "../canonical-presentation";
import { canonicalBreachMinutes, canonicalCheckSummary, canonicalImpact, canonicalMargins } from "../canonical-overview";
import { selectCanonicalComputeView } from "../canonical-compute";
import { selectCanonicalBatteryView } from "../canonical-battery-view";
import { EVIDENCE_VERSION, PROMPT_VERSION, factSchema, type BriefFact } from "./contracts";

/** Projection only: all physical accounting stays in the existing canonical selectors. */
export function buildBriefEvidence(a: CanonicalPresentation, jobId: string | null = null) {
  const checkSummary = canonicalCheckSummary(a);
  const compute = selectCanonicalComputeView(a, a.points[0].timestamp);
  const battery = selectCanonicalBatteryView(a, a.points[0].timestamp);
  const impact = canonicalImpact(a);
  const margins = canonicalMargins(a, 0)[0];
  const facts: BriefFact[] = [];
  const add = (id: string, label: string, value: number | string | boolean | null,
    unit: BriefFact["unit"], selector: string, field: string, view: BriefFact["source"]["view"],
    scope: BriefFact["scope"] = "full_horizon", absent: "unavailable" | "not_applicable" = "unavailable") => {
    facts.push(factSchema.parse({ id, label, value, unit, scope, availability: value === null ? absent : "available",
      source: { selector, field, view } }));
  };
  add("power.baseline_peak", "Baseline peak import", impact.baselinePeakMw, "MW", "canonicalImpact", "baselinePeakMw", "overview");
  add("power.plan_peak", "Plan peak import", impact.planPeakMw, "MW", "canonicalImpact", "planPeakMw", "overview");
  add("power.safety_margin", "Whole-plan safety-target margin", margins.safety, "MW", "canonicalMargins", "peak.safety", "overview");
  add("power.facility_margin", "Whole-plan facility-limit margin", margins.facility, "MW", "canonicalMargins", "peak.facility", "overview");
  add("power.limit", "Facility import limit", a.limitMw, "MW", "CanonicalPresentation", "limitMw", "overview");
  add("power.target", "Safety target", a.targetMw, "MW", "CanonicalPresentation", "targetMw", "overview");
  add("power.target_met", "Safety target met within model", battery.targetMet, "status", "selectCanonicalBatteryView", "targetMet", "overview");
  add("power.breach_minutes", "Time above facility limit", canonicalBreachMinutes(a, false), "min", "canonicalBreachMinutes", "minutes", "overview");
  add("workloads.completed", "Workloads completed", compute.completed, "count", "selectCanonicalComputeView", "completed", "compute");
  add("workloads.total", "Workloads assessed", compute.jobs.length, "count", "selectCanonicalComputeView", "jobs.length", "compute");
  add("workloads.remaining", "Remaining work at horizon end", compute.remaining, "work h", "selectCanonicalComputeView", "remaining", "compute");
  add("workloads.deadlines_met", "Deadline checks met", compute.deadlinesMet, "count", "selectCanonicalComputeView", "deadlinesMet", "compute");
  add("workloads.deadlines_missing", "Deadline checks unavailable", compute.deadlineUnavailable, "count", "selectCanonicalComputeView", "deadlineUnavailable", "compute");
  for (const [index, job] of compute.jobs.entries()) {
    add(`workload.${index}.id`, `Workload ${index + 1}: identity`, job.id, "status", "selectCanonicalComputeView", `jobs[${index}].id`, "compute", "submitted_model");
    add(`workload.${index}.remaining`, `Workload ${index + 1}: remaining work`, job.remaining, "work h", "selectCanonicalComputeView", `jobs[${index}].remaining`, "compute", "workload_horizon");
    add(`workload.${index}.deadline`, `Workload ${index + 1}: deadline met`, job.deadlineMet ?? null, "status", "selectCanonicalComputeView", `jobs[${index}].deadlineMet`, "compute", "workload_horizon");
    add(`workload.${index}.protected`, `Workload ${index + 1}: protected`, job.protectedWork, "status", "selectCanonicalComputeView", `jobs[${index}].protectedWork`, "compute", "submitted_model");
  }
  add("battery.present", "Battery included", !!a.batteryAudit, "status", "CanonicalPresentation", "batteryAudit", "power", "submitted_model");
  const absent = a.batteryAudit ? "unavailable" : "not_applicable";
  add("battery.minimum_soc", "Minimum modelled SOC", battery.minimumSoc, "%", "selectCanonicalBatteryView", "minimumSoc", "power", "full_horizon", absent);
  add("battery.reserve_soc", "Protected reserve", a.batteryAudit ? a.protectedSocPercent : null, "%", "CanonicalPresentation", "protectedSocPercent", "power", "submitted_model", absent);
  add("battery.reserve_protected", "Reserve protected", battery.reserveProtected, "status", "selectCanonicalBatteryView", "reserveProtected", "power", "full_horizon", absent);
  add("battery.ac_discharge", "Battery energy delivered (AC)", a.batteryAudit ? battery.dischargeMwh : null, "MWh AC", "selectCanonicalBatteryView", "dischargeMwh", "power", "full_horizon", absent);
  add("battery.terminal_energy", "Terminal stored energy (DC)", battery.terminal?.endMwh ?? null, "MWh DC", "selectCanonicalBatteryView", "terminal.endMwh", "power", "full_horizon", absent);
  add("battery.terminal_target", "Terminal target (DC)", battery.terminal?.targetMwh ?? null, "MWh DC", "selectCanonicalBatteryView", "terminal.targetMwh", "power", "full_horizon", absent);
  for (const check of checkSummary.checks) {
    add(`check.${check.id}`, check.label, check.state === "unavailable" || check.state === "not_applicable" ? null : check.value,
      "status", "canonicalCheckSummary", `checks.${check.id}`, check.id === "terminal" ? "power" : check.id === "import" ? "overview" : "compute", "full_horizon",
      check.state === "not_applicable" ? "not_applicable" : "unavailable");
  }
  add("solver.status", "Solver outcome", a.projected.identity.status, "status", "CanonicalPresentation", "identity.status", "overview", "submitted_model");
  const identity = a.projected.identity;
  const classification = identity.truthClass === "synthetic_demonstration" ? "Synthetic model" : "Submitted model assessment";
  return { version: EVIDENCE_VERSION, identity, scope: "full planning horizon", facts,
    checks: checkSummary.checks.map(check => ({ id: check.id, state: check.state })),
    receipt: { jobId, inputFingerprint: identity.inputFingerprint, resultFingerprint: identity.resultFingerprint,
      modelFingerprint: identity.modelFingerprint, engineVersion: identity.engineVersion, solverStatus: identity.status,
      solverTermination: identity.solverTermination, optimalityGap: identity.optimalityGap, truthClass: identity.truthClass,
      horizonStart: a.points[0].timestamp, horizonEnd: a.points.at(-1)!.endTimestamp!, intervalCount: a.points.length,
      intervalMinutes: [...new Set(a.points.map(point => point.durationMinutes!))], evidenceVersion: EVIDENCE_VERSION, promptVersion: PROMPT_VERSION },
    limitations: [`${classification}; not measured delivery, a live forecast or equipment control.`,
      "Additional connection capacity and causal binding constraints are not assessed.",
      "Peaks may occur at different times. Review submitted assumptions and missing checks before a decision."] };
}
export type BriefEvidence = ReturnType<typeof buildBriefEvidence>;
