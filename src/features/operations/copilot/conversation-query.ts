import type { CanonicalPresentation } from "../canonical-presentation";
import { selectCanonicalComputeView } from "../canonical-compute";
import { selectCanonicalBatteryView } from "../canonical-battery-view";
import { buildBriefEvidence } from "./evidence";
import { eligibleBriefClaims, formatBriefFact } from "./brief";
import { factSchema, type BriefFact } from "./contracts";
import { CHAT_VERSION, conversationResponseSchema, type ConversationQuery, type ConversationRequest } from "./conversation-contracts";

export const definitionText = {
  none: "Ask about SOC, reserve, terminal energy, MILP, optimality or MW versus MWh.",
  soc: "State of charge (SOC) is stored battery energy as a percentage of the model's health-adjusted capacity. Interval-end SOC follows that interval's charging or discharging.",
  terminal: "The terminal-energy target is the required stored battery energy at the planning horizon's end. It prevents the plan from treating depletion at the boundary as a free benefit.",
  milp: "Mixed-integer linear programming jointly chooses discrete scheduling decisions and continuous power decisions subject to the submitted restrictions. A feasible solution is not necessarily proven optimal.",
  reserve: "Protected reserve is battery energy excluded from ordinary planned use. Respecting this reserve within a model does not establish backup autonomy.",
  power_energy: "MW measures power at an interval; MWh measures energy over time. Battery AC charge/discharge energy differs from DC stored energy because of conversion losses.",
  pue: "PUE is total facility energy divided by IT energy over the same period and measurement boundary. In this component model PUE is a reference; cooling and electrical losses are calculated separately, so multiplying again would double-count overhead.",
  optimality: "A feasible plan satisfies the accepted model checks. Proven optimality additionally requires the solver's optimal termination within its reported tolerances; a time-limited incumbent may remain unproven.",
};

/** Deterministic queries over accepted selectors; no second solver or model-authored numbers. */
export function answerConversation(a: CanonicalPresentation, request: ConversationRequest, query: ConversationQuery,
  provider: { model: string; responseId: string | null; usage: { inputTokens: number; outputTokens: number } | null }) {
  const envelope = buildBriefEvidence(a, request.jobId);
  const facts: BriefFact[] = [];
  const blocks: string[] = [];
  const navigation: { view: "overview" | "compute" | "power"; timestamp: string | null; workloadId: string | null }[] = [];
  let kind: "answer" | "clarification" | "requires_calculation" | "unsupported" = "answer";
  const respond = () => conversationResponseSchema.parse({ version: CHAT_VERSION, kind,
    basis: ["definition", "knowledge", "accounting"].includes(query.intent) ? "general_explanation" : kind === "answer" ? "model_evidence" : "no_calculation",
    question: request.question, resolvedQuery: query, blocks,
    evidence: facts, navigation, receipt: { ...envelope.receipt, promptVersion: "conversation-analysis-v2", providerResponseId: provider.responseId, usage: provider.usage },
    generatedAt: new Date().toISOString(), model: provider.model, limitations: envelope.limitations });
  const stop = (state: typeof kind, text: string) => { kind = state; blocks.push(text); return respond(); };
  const compute = selectCanonicalComputeView(a, a.points[0].timestamp);
  if (request.context.timestamp && !a.points.some(p => p.timestamp === request.context.timestamp))
    return stop("clarification", "Select an interval in this accepted plan and ask again.");
  if (request.context.workloadId && !compute.jobs.some(j => j.id === request.context.workloadId))
    return stop("clarification", "Select a workload from this accepted plan and ask again.");
  if (query.intent === "what_if") return stop("requires_calculation",
    "This changes the submitted model and requires a new MILP calculation. Review the requested change in the inputs, then explicitly optimise a new plan. No inputs were changed and no alternative result has been calculated.");
  if (query.intent === "why") return stop("unsupported",
    "I can show the returned power balance and submitted restrictions, but this result does not establish why the solver preferred this decision over alternatives. Ask for the interval balance or workload constraints. Testing an alternative requires a separate calculation.");
  if (query.intent === "unsupported") return stop("unsupported",
    "I can inspect this modelled plan, workloads, battery, limits and checks. I cannot establish unmodelled cost/carbon savings, live equipment status, backup guarantees or execute control commands.");
  if (query.intent === "clarify") return stop("clarification",
    "Which workload, interval (date and UTC time), or plan metric do you mean? You can select an interval in the charts and ask about that interval.");
  if (query.intent === "knowledge" || (query.intent === "constraints" && !query.workloadId)) {
    for (const fact of envelope.facts.filter(f => f.id.startsWith("planning.") || f.id === "power.interval_envelope")) {
      facts.push(fact); blocks.push(`${fact.label}: ${formatBriefFact(fact)}.`);
    }
    if (facts.some(f => f.id === "planning.reporting_gaps")) blocks.push("Reporting completeness is an evidence review, not legal certification. A daily plan does not establish annual measured performance.");
  }
  if (query.intent === "knowledge") return stop("answer", /\bwhy\b.*\bnew\b.*\bcalculation\b.*\bchang/i.test(request.question)
    ? "The accepted result applies only to its submitted inputs. Changing an input can change feasibility, battery reserve and workload completion. A separately confirmed calculation is required before comparing outcomes; the original plan remains unchanged."
    : "Operational guidance is shown with its source below. It does not establish this site's equipment condition or authorise operation.");
  if (query.intent === "accounting") return stop("answer", "Fixed-schedule tariff accounting does not require another MILP solve. Use the reviewed accounting tool with a complete EUR/MWh tariff. The reviewed tariff tool can include supplied supplier markup, network energy charges and incremental annual capacity liability against a prior billing peak. Taxes and export credits require separate rules; no total-bill saving is inferred from this plan alone.");
  if (query.intent === "experiment") return stop("clarification", "Select a completed stress experiment attached to this accepted plan.");
  if (query.intent === "definition") { blocks.push(definitionText[query.definition]); return respond(); }
  const job = query.workloadId ? compute.jobs.find(j => j.id === query.workloadId) : null;
  if (query.workloadId && !job) return stop("clarification", "That workload is not in this plan. Ask using its displayed name or select it in Compute & Workloads.");
  if (query.intent === "workloads") {
    blocks.push("Scheduled workload execution (UTC, modelled):");
    for (const scheduled of compute.jobs) {
      const label = `${scheduled.name}: ${scheduled.first ?? "no returned activity"} to ${scheduled.last ?? "no returned end"}.`;
      blocks.push(label);
      facts.push(factSchema.parse({ id: `schedule.${facts.length}`, label: scheduled.name, unit: "status", scope: "workload_horizon",
        availability: "available", value: `${scheduled.first ?? "Unavailable"} to ${scheduled.last ?? "Unavailable"}`,
        source: { view: "compute", selector: "selectCanonicalComputeView", field: `${scheduled.id}.segments` } }));
      if (navigation.length < 8) navigation.push({ view: "compute", timestamp: scheduled.first, workloadId: scheduled.id });
    }
    blocks.push("The returned assessment does not contain per-workload baseline execution trajectories. These schedules alone cannot establish which jobs moved relative to the baseline. Earliest permitted start is not a baseline schedule.");
    return respond();
  }
  let timestamp = query.start ?? request.context.timestamp ?? a.points[0].timestamp;
  const battery = selectCanonicalBatteryView(a, timestamp);
  if (query.focus === "peak") timestamp = battery.peak;
  if (query.focus === "minimum_soc") {
    if (!a.batteryAudit) return stop("unsupported", "No battery is included in this assessment. SOC and reserve are not applicable.");
    // Minimum selector includes the initial boundary; never confuse that with interval-end minimum.
    if (a.batteryAudit.initialSocPercent <= Math.min(...a.points.map(p => p.socPercent!))) {
      blocks.push("The minimum SOC occurs at the initial boundary (possibly tied later). The following interval shows the initial and interval-end values.");
      timestamp = a.points[0].timestamp;
    } else timestamp = a.points.reduce((best, p) => p.socPercent! < best.socPercent! ? p : best).timestamp;
  }
  if (query.focus === "first_charge" || query.focus === "first_discharge") {
    const event = battery.events.find(e => e.label === (query.focus === "first_charge" ? "First charge" : "First discharge"));
    if (!event?.point) return stop("unsupported", "No matching battery event is returned in this plan.");
    timestamp = event.point.timestamp;
  }
  const index = a.points.findIndex(p => Date.parse(p.timestamp) === Date.parse(timestamp));
  if (index >= 0) timestamp = a.points[index].timestamp;
  const endIndex = query.end ? a.points.findIndex(p => Date.parse(p.timestamp) === Date.parse(query.end!) || Date.parse(p.endTimestamp!) === Date.parse(query.end!)) : index;
  if (index < 0 || (query.end && (Date.parse(query.end) <= Date.parse(timestamp) || endIndex < 0)))
    return stop("clarification", "Use a date and UTC time on this plan's interval boundaries, within its planning horizon.");
  const add = (id: string, label: string, value: number | boolean | string | null, unit: BriefFact["unit"],
    view: "overview" | "compute" | "power", selector: string, field: string) => {
    const fact = factSchema.parse({ id, label, value, unit, scope: id.startsWith("range.") ? "selected_range" : id.startsWith("interval.") || id === "job.power" ? "interval" :
      id.startsWith("job.") && query.intent === "workload" ? "workload_horizon" : "submitted_model", availability: value === null ? "unavailable" : "available",
      source: { view, selector, field } }); facts.push(fact); blocks.push(`${label}: ${formatBriefFact(fact)}.`);
  };
  const claims = eligibleBriefClaims(envelope);
  const include = (ids: string[]) => {
    for (const claim of claims.filter(c => ids.includes(c.id))) {
      blocks.push(claim.text);
      for (const id of claim.factIds) if (!facts.some(f => f.id === id)) facts.push(envelope.facts.find(f => f.id === id)!);
    }
  };
  if (["summary", "power", "checks"].includes(query.intent)) {
    include(query.intent === "summary" ? ["solver", "peak", "target_met", "target_unmet", "workload_outcome", "battery_reserve", "no_battery"] :
      query.intent === "power" ? ["peak", "limit", "operating_margins", "target_met", "target_unmet"] :
      ["solver", "workload_outcome", ...claims.filter(c => c.id.startsWith("check_")).map(c => c.id)]);
    navigation.push({ view: "overview", timestamp: query.intent === "power" ? battery.peak : timestamp, workloadId: null });
  } else if (query.intent === "workload" || query.intent === "constraints") {
    if (!job && query.intent === "constraints") {
      blocks.push("Selected submitted restrictions (not a complete catalogue of every solver constraint):");
      for (const id of ["power.limit", "power.target", "battery.reserve_soc", "battery.terminal_target"]) {
        const fact = envelope.facts.find(f => f.id === id)!; facts.push(fact); blocks.push(`${fact.label}: ${formatBriefFact(fact)}.`);
      }
      if (a.batteryAudit) {
        add("battery.capacity", "Health-adjusted battery capacity", a.batteryAudit.capacity, "MWh DC", "power", "canonicalBatteryPresentation", "capacity");
        add("battery.ceiling", "Maximum SOC", a.batteryAudit.maximumSocPercent, "%", "power", "canonicalBatteryPresentation", "maximumSocPercent");
      }
      blocks.push("These restrictions describe the submitted model, not measured equipment capability. Ask about a named workload for its scheduling restrictions.");
      navigation.push({ view: "overview", timestamp: null, workloadId: null });
      return respond();
    }
    if (!job) return stop("clarification", `Which workload? Available names: ${compute.jobs.map(j => j.name).join(", ")}.`);
    add("job.name", "Workload", job.name, "status", "compute", "selectCanonicalComputeView", `${job.id}.name`);
    blocks.push("Times below are UTC; execution is modelled, not delivered.");
    if (query.intent === "constraints") {
      add("job.earliest", "Declared earliest start", job.earliest, "status", "compute", "selectCanonicalComputeView", `${job.id}.earliest`);
      add("job.deadline", "Declared deadline", job.deadline, "status", "compute", "selectCanonicalComputeView", `${job.id}.deadline`);
      for (const [key, label, value, unit] of [
        ["nominal", "Nominal reference power", job.nominalPower, "MW"], ["minimum", "Minimum power cap", job.minimumPower, "MW"],
        ["duration", "Expected duration", job.expectedMinutes, "min"], ["delay", "Maximum start delay", job.maxDelay, "min"],
        ["minGpu", "Minimum GPUs", job.minGpu, "count"], ["maxGpu", "Maximum GPUs", job.maxGpu, "count"],
        ["throughput", "Minimum throughput fraction", job.minimumThroughput, "status"],
      ] as const) add(`job.${key}`, label, value, unit, "compute", "selectCanonicalComputeView", `${job.id}.${key}`);
      add("job.protected", "Protected workload", job.protectedWork, "status", "compute", "selectCanonicalComputeView", `${job.id}.protectedWork`);
    } else {
      add("job.first", "First modelled activity", job.first, "status", "compute", "selectCanonicalComputeView", `${job.id}.first`);
      add("job.last", "Last activity ends", job.last ?? null, "status", "compute", "selectCanonicalComputeView", `${job.id}.last`);
      add("job.remaining", "Remaining work at horizon end", job.remaining, "work h", "compute", "selectCanonicalComputeView", `${job.id}.remaining`);
      add("job.met", "Deadline met within model", job.deadlineMet ?? null, "status", "compute", "selectCanonicalComputeView", `${job.id}.deadlineMet`);
      const current = job.points[index];
      add("job.power", `Scheduled power at ${timestamp}`, current.power_mw, "MW", "compute", "selectCanonicalComputeView", `${job.id}.points[${index}].power_mw`);
      blocks.push("First and last activity do not imply continuous execution. Inspect the execution lane for gaps and checkpoints.");
    }
    navigation.push({ view: "compute", timestamp: query.start ? timestamp : job.first ?? timestamp, workloadId: job.id });
  } else {
    if (query.intent === "battery") include(["battery_reserve", "battery_energy", "no_battery"]);
    const last = query.end ? a.points.findIndex(p => Date.parse(p.endTimestamp!) === Date.parse(query.end!)) : index;
    const stopIndex = query.end ? (last >= 0 ? last : endIndex - 1) : index;
    if (query.intent === "battery" && !a.batteryAudit) return respond();
    let inspectedIndices = Array.from({ length: stopIndex - index + 1 }, (_, i) => index + i);
    if (query.end) {
      const range = inspectedIndices.map(i => a.points[i]);
      const energy = (field: "gridImportMw" | "batteryPowerMw", direction: "import" | "discharge" | "charge") =>
        range.some(point => point.durationMinutes === null || point[field] === null) ? null : range.reduce((total, point) => total + (direction === "import" ? point[field] ?? 0 :
          direction === "discharge" ? Math.max(0, point[field] ?? 0) : Math.max(0, -(point[field] ?? 0))) * (point.durationMinutes ?? 0) / 60, 0);
      add("range.import", "Range grid-import energy", energy("gridImportMw", "import"), "MWh AC", "power", "CanonicalPresentation", "range.integratedGridImport");
      if (a.batteryAudit) add("range.discharge", "Range battery discharge energy", energy("batteryPowerMw", "discharge"), "MWh AC", "power", "CanonicalPresentation", "range.integratedDischarge");
      if (a.batteryAudit) add("range.charge", "Range battery charge energy", energy("batteryPowerMw", "charge"), "MWh AC", "power", "CanonicalPresentation", "range.integratedCharge");
    }
    if (inspectedIndices.length > 4) {
      const range = inspectedIndices;
      const peakIndex = range.reduce((best, i) => a.points[i].gridImportMw > a.points[best].gridImportMw ? i : best);
      const lowSoc = a.batteryAudit ? range.reduce((best, i) => a.points[i].socPercent! < a.points[best].socPercent! ? i : best) : index;
      inspectedIndices = [...new Set([index, peakIndex, lowSoc, stopIndex])].sort((x, y) => x - y);
      blocks.push(`Range summary (${timestamp} to ${query.end}, UTC): showing boundary intervals, highest grid import and lowest interval-end SOC where applicable. Open the charts for every interval; these samples do not imply continuous activity.`);
    }
    for (const i of inspectedIndices) {
      const p = a.points[i], selected = selectCanonicalBatteryView(a, p.timestamp);
      add(`interval.${i}.time`, "Interval (UTC)", `${p.timestamp} – ${p.endTimestamp}`, "status", "power", "CanonicalPresentation", `points[${i}]`);
      add(`interval.${i}.demand`, "Planned demand before battery", p.facilityDemandMw ?? null, "MW", "power", "CanonicalPresentation", `points[${i}].facilityDemandMw`);
      add(`interval.${i}.import`, "Grid import", p.gridImportMw, "MW", "power", "CanonicalPresentation", `points[${i}].gridImportMw`);
      if (a.request.facility.import_limit_profile_mw || p.limitMw !== a.limitMw || p.targetMw !== a.targetMw) {
      add(`interval.${i}.limit`, "Interval facility limit", p.limitMw ?? a.limitMw, "MW", "power", "CanonicalPresentation", `points[${i}].limitMw`);
      const limitText = blocks.pop()!;
      add(`interval.${i}.target`, "Interval safety target", p.targetMw ?? a.targetMw, "MW", "power", "CanonicalPresentation", `points[${i}].targetMw`);
      const targetText = blocks.pop()!;
      blocks[blocks.length - 1] += ` ${limitText} ${targetText}`;
      }
      add(`interval.${i}.battery`, "Battery dispatch (+ discharge / − charge)", p.batteryPowerMw ?? null, "MW", "power", "CanonicalPresentation", `points[${i}].batteryPowerMw`);
      if (query.intent === "battery") {
        add(`interval.${i}.startSoc`, "Start SOC", p.startingSocPercent ?? null, "%", "power", "CanonicalPresentation", `points[${i}].startingSocPercent`);
        add(`interval.${i}.endSoc`, "End SOC", p.socPercent ?? null, "%", "power", "CanonicalPresentation", `points[${i}].socPercent`);
        add(`interval.${i}.energy`, "DC energy above protected reserve", selected.energyAboveReserveMwh, "MWh DC", "power", "selectCanonicalBatteryView", "energyAboveReserveMwh");
      }
      if (query.intent === "interval") {
        const running = selectCanonicalComputeView(a, p.timestamp).jobs.filter(j => j.current.power_mw > 0 || j.current.checkpoint_or_restart);
        for (const j of running) {
          add(`interval.${i}.${j.id}.name`, "Workload name", j.name, "status", "compute", "selectCanonicalComputeView", `${j.id}.name`);
          add(`interval.${i}.${j.id}`, `${j.name}${j.current.checkpoint_or_restart ? " (checkpoint/restart)" : ""}`, j.current.power_mw,
          "MW", "compute", "selectCanonicalComputeView", `${j.id}.points[${i}].power_mw`);
        }
        if (!running.length) blocks.push("No workload activity is returned in this interval.");
      }
    }
    navigation.push({ view: query.intent === "battery" ? "power" : "compute", timestamp, workloadId: null });
  }
  return respond();
}
