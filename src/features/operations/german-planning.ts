import { z } from "zod";
import { germanReportingContextSchema } from "./german-evidence";
import type { FacilityPlanRequest } from "../analytics/contracts";

const evidence = z.object({ source: z.string().trim().min(1).max(500), reviewedAt: z.string().datetime(),
  basis: z.enum(["assumption", "supplier_contract", "operator_contract", "historical_market"]) }).strict();
export const germanPlanningSchema = z.object({
  enabled: z.boolean(), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prices: z.array(z.number().finite()).max(100).default([]),
  importLimits: z.array(z.number().finite().nonnegative()).max(100).default([]),
  reporting: germanReportingContextSchema.optional(), evidence: evidence.optional(), batteryFlexPermitted: z.boolean().default(true),
}).strict();
export type GermanPlanning = z.infer<typeof germanPlanningSchema>;
export const defaultGermanPlanning: GermanPlanning = { enabled: false, localDate: "2026-09-26",
  prices: [], importLimits: [], batteryFlexPermitted: true };

/** Resolve Berlin midnight with IANA timezone rules; never assume a 24-hour local day.
 * All engine timestamps remain UTC. Repeated autumn wall-clock times retain offsets. */
export function germanDayIntervals(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
    throw new Error("Enter a valid calendar date.");
  const wall = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const midnight = (day: string) => {
    const nominal = Date.parse(`${day}T00:00:00Z`);
    for (let delta = -180; delta <= 180; delta += 15) {
      const instant = nominal + delta * 60_000;
      const parts = Object.fromEntries(wall.formatToParts(instant).map(p => [p.type, p.value]));
      if (`${parts.year}-${parts.month}-${parts.day}` === day && parts.hour === "00" && parts.minute === "00") return instant;
    }
    throw new Error("Local midnight could not be resolved.");
  };
  const start = midnight(date), next = new Date(Date.parse(`${date}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  const count = (midnight(next) - start) / 900_000;
  if (![92, 96, 100].includes(count)) throw new Error("Unsupported German planning day.");
  return Array.from({ length: count }, (_, index) => ({ index, start: new Date(start + index * 900_000).toISOString(), duration_minutes: 15 }));
}

export function berlinIntervalLabel(utc: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
    timeZoneName: "shortOffset", hourCycle: "h23" }).format(new Date(utc));
}

/** Strict timestamped interchange for SMARD-derived exports. Normalize source CSV once
 * to start_utc;end_utc;price_eur_per_mwh; ambiguous local timestamps fail closed. */
export function parseGermanPriceCsv(text: string, intervals: ReturnType<typeof germanDayIntervals>) {
  const rows = text.trim().replace(/^\uFEFF/, "").split(/\r?\n/);
  if (rows.shift() !== "start_utc;end_utc;price_eur_per_mwh") throw new Error("Use start_utc;end_utc;price_eur_per_mwh CSV headers.");
  if (rows.length !== intervals.length) throw new Error("Price records must cover every planning interval exactly.");
  return rows.map((row, i) => {
    const cells = row.split(";"), interval = intervals[i];
    if (cells.length !== 3 || !/Z$/.test(cells[0]) || !/Z$/.test(cells[1]) ||
        Date.parse(cells[0]) !== Date.parse(interval.start) || Date.parse(cells[1]) !== Date.parse(interval.start) + 900_000 ||
        !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cells[2])) throw new Error(`Invalid, missing or misaligned price at row ${i + 2}.`);
    const value = Number(cells[2]);
    if (!Number.isFinite(value)) throw new Error("Prices must be finite EUR/MWh.");
    return value;
  });
}

/** Shared validation for the editable interval envelope. */
export function connectionEnvelopeError(text: string, count: number, ceiling: number): string {
  if (!text.trim()) return "";
  const cells = text.trim().split(/\s+/);
  if (cells.some(cell => !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(cell) || !Number.isFinite(Number(cell))))
    return "Enter nonnegative MW values separated by spaces.";
  if (cells.length !== count) return `Supply ${count} interval limits; currently ${cells.length}.`;
  if (cells.some(cell => Number(cell) > ceiling)) return `Limits cannot exceed the facility ceiling (${ceiling} MW).`;
  return "";
}

export function applyGermanPlanning(request: FacilityPlanRequest, raw: GermanPlanning): FacilityPlanRequest {
  const context = germanPlanningSchema.parse(raw);
  if (!context.enabled) return request;
  const intervals = germanDayIntervals(context.localDate);
  if (intervals.length !== request.intervals.length || intervals.some((p, i) => p.start !== request.intervals[i].start))
    throw new Error("Build the model using the selected German day before applying market context.");
  if ((context.prices.length || context.importLimits.length) && !context.evidence)
    throw new Error("Imported assumptions need a source and dated review.");
  if (context.prices.length && context.prices.length !== intervals.length) throw new Error("Prices must align with the entire day.");
  if (context.importLimits.length && (context.importLimits.length !== intervals.length ||
      context.importLimits.some(limit => limit > Number(request.facility.import_limit_mw))))
    throw new Error("Connection limits must align and cannot exceed the configured ceiling.");
  const reserve = Number(request.facility.import_limit_mw) - Number(request.policy.operating_target_mw ?? request.facility.import_limit_mw);
  if (!Number.isFinite(reserve) || reserve < 0) throw new Error("Operating target must not exceed the facility ceiling.");
  return { ...request, planning_context: { timezone: "Europe/Berlin", local_date: context.localDate,
    provenance: context.evidence ?? { source: "Synthetic demonstration", basis: "assumption" }, pue_accounting: "component_reference_only", ...(context.reporting ? { reporting_evidence: context.reporting } : {}) },
    economics: { ...request.economics, ...(context.prices.length ? { import_price_eur_per_mwh: context.prices } : {}) },
    facility: { ...request.facility, ...(context.importLimits.length ? { import_limit_profile_mw: context.importLimits } : {}) },
    policy: { ...request.policy, allow_battery: context.batteryFlexPermitted && request.policy.allow_battery !== false,
      ...(context.importLimits.length ? { operating_target_profile_mw: context.importLimits.map(limit => Math.max(0, limit - reserve)) } : {}) } };
}
