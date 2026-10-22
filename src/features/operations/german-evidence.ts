import { z } from "zod";

/** Evidence applicability, not legal certification. Legislative proposals are
 * never executable rules. A reviewer must recheck the cited consolidated law. */
export const germanReportingContextSchema = z
  .object({
    commissionedAt: z.string().datetime(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    nonRedundantConnectionKw: z.number().nonnegative(),
    installedItKw: z.number().nonnegative(),
    publicOperator: z.boolean(),
    facilityBoundaryReviewed: z.boolean(),
    renewableEvidenceReviewed: z.boolean(),
    heatEvidenceReviewed: z.boolean(),
    managementSystemEvidenceReviewed: z.boolean(),
    rulesReviewedAt: z.string().datetime(),
  })
  .strict();
export type GermanReportingContext = z.infer<typeof germanReportingContextSchema>;

export function assessGermanEvidence(
  context?: GermanReportingContext,
  asOf = new Date().toISOString(),
) {
  const sources = [
    "https://www.gesetze-im-internet.de/enefg/__11.html",
    "https://www.gesetze-im-internet.de/enefg/__12.html",
    "https://eur-lex.europa.eu/eli/reg_del/2024/1364/oj",
  ];
  const missing: string[] = [];
  if (!context)
    missing.push("Commissioning date, reporting period, facility category and capacity thresholds");
  else {
    context = germanReportingContextSchema.parse(context);
    const start = new Date(context.periodStart),
      end = new Date(context.periodEnd);
    if (
      start.getUTCMonth() !== 0 ||
      start.getUTCDate() !== 1 ||
      start.getUTCHours() !== 0 ||
      start.getUTCMinutes() !== 0 ||
      start.getUTCSeconds() !== 0 ||
      end.getTime() !== Date.UTC(start.getUTCFullYear() + 1, 0, 1)
    )
      missing.push("A complete calendar-year reporting boundary");
    if (end.getTime() > Date.parse(asOf))
      missing.push("Completed reporting period (not a forecast)");
    const age = Date.parse(asOf) - Date.parse(context.rulesReviewedAt);
    if (age < 0 || age > 90 * 86_400_000) missing.push("Current dated legal-applicability review");
    if (!context.facilityBoundaryReviewed)
      missing.push("Reviewed facility and IT measurement boundaries");
    if (!context.renewableEvidenceReviewed) missing.push("Reviewed renewable-electricity evidence");
    if (!context.heatEvidenceReviewed)
      missing.push("Reviewed heat-reuse evidence and applicable exceptions");
    if (!context.managementSystemEvidenceReviewed)
      missing.push("Energy/environmental-management evidence");
  }
  return {
    rulesVersion: "de-evidence-review-2026-10-22",
    sources,
    assessedAt: asOf,
    missing,
    applicabilityReviewRequired: true,
    legalComplianceConfirmed: false as const,
    euReportingScope: context ? context.installedItKw >= 500 : null,
    commissioningCohort: context
      ? Date.parse(context.commissionedAt) < Date.parse("2026-07-01T00:00:00Z")
        ? "before-july-2026"
        : "from-july-2026"
      : null,
    warning:
      "Evidence completeness is not legal compliance. Enacted rules, commissioning cohorts, exceptions and any amendments require qualified review; draft amendments are not applied.",
  };
}
