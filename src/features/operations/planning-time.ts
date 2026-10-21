import { z } from "zod";

const instant = z.string().datetime({ offset: true });
const range = z.object({ start: instant, end: instant }).strict();

/** Exchange contract only: time validation never schedules jobs or dispatches equipment. */
export const planningTimeSchema = z
  .object({
    schemaVersion: z.literal("gridpulse-planning-time-v1"),
    purpose: z.enum(["scenario", "rolling", "day_ahead", "event", "historical"]),
    assessedAt: instant,
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "A valid IANA timezone is required"),
    decision: range,
    calculation: range,
    intervals: z.array(range).min(1).max(35_040),
    forecastIssuedAt: instant.nullable(),
    sourceFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    initialStateReference: z.string().min(1).max(200),
    terminalPolicy: z.enum(["report_unfinished", "reserve_and_completion_required"]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const start = Date.parse(value.calculation.start),
      end = Date.parse(value.calculation.end);
    if (end <= start) fail("calculation", "Calculation end must follow start");
    if (
      Date.parse(value.decision.start) < start ||
      Date.parse(value.decision.end) > end ||
      Date.parse(value.decision.end) <= Date.parse(value.decision.start)
    )
      fail("decision", "Decision period must be nonempty and inside the calculation horizon");
    let previous = start;
    for (const interval of value.intervals) {
      const a = Date.parse(interval.start),
        b = Date.parse(interval.end);
      if (a !== previous || b <= a || b > end) {
        fail(
          "intervals",
          "Intervals must be chronological, contiguous and cover the calculation horizon",
        );
        break;
      }
      previous = b;
    }
    if (previous !== end) fail("intervals", "Intervals must end at the calculation boundary");
    if (value.forecastIssuedAt && Date.parse(value.forecastIssuedAt) > Date.parse(value.assessedAt))
      fail(
        "forecastIssuedAt",
        "A forecast issued after the assessment cutoff is not available evidence",
      );
    if (["rolling", "day_ahead", "event"].includes(value.purpose)) {
      if (!value.forecastIssuedAt || !value.sourceFingerprint)
        fail("sourceFingerprint", "Forward planning requires versioned forecast provenance");
      if (Date.parse(value.decision.start) < Date.parse(value.assessedAt))
        fail("decision", "Forward decisions cannot start before the assessment cutoff");
    }
  });
export type PlanningTime = z.infer<typeof planningTimeSchema>;

/** Calculate elapsed durations from the full timeline before any display filtering. */
export function intervalDurationsHours(points: { timestamp: string }[], finalMinutes = 15) {
  if (!(finalMinutes > 0) || !Number.isFinite(finalMinutes))
    throw new Error("Invalid final interval duration");
  return points.map((point, index) => {
    const start = Date.parse(point.timestamp);
    const end =
      index + 1 < points.length
        ? Date.parse(points[index + 1].timestamp)
        : start + finalMinutes * 60_000;
    if (!Number.isFinite(start) || !(end > start))
      throw new Error("Intervals must identify unique chronological instants");
    return (end - start) / 3_600_000;
  });
}

export function scenarioPlanningTime(
  points: { timestamp: string }[],
  assessedAt: string,
): PlanningTime {
  const hours = intervalDurationsHours(points);
  if (!points.length) throw new Error("A calculation horizon requires intervals");
  const intervals = points.map((point, index) => ({
    start: point.timestamp,
    end: new Date(Date.parse(point.timestamp) + hours[index] * 3_600_000).toISOString(),
  }));
  const calculation = { start: intervals[0].start, end: intervals.at(-1)!.end };
  return planningTimeSchema.parse({
    schemaVersion: "gridpulse-planning-time-v1",
    purpose: "scenario",
    assessedAt,
    timezone: "UTC",
    decision: calculation,
    calculation,
    intervals,
    forecastIssuedAt: null,
    sourceFingerprint: null,
    initialStateReference: "configured-scenario-initial-state",
    terminalPolicy: "report_unfinished",
  });
}
