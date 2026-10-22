import { z } from "zod";
export function invalidEvidence(message: string): never {
  throw new z.ZodError([{ code: "custom", path: ["evidence"], message }]);
}

/** Ingestion policy shared by CSV, API and presentation adapters. */
export function evidenceInstant(value: string): string {
  const parsed = z.string().datetime({ offset: true }).safeParse(value);
  if (!parsed.success || !Number.isFinite(Date.parse(value)))
    invalidEvidence("Evidence timestamp requires an explicit UTC offset or Z.");
  return new Date(value).toISOString();
}

export function chronologicalEvidence<T extends { timestamp: string }>(rows: T[]): T[] {
  const normalized = rows.map((row) => ({ ...row, timestamp: evidenceInstant(row.timestamp) }));
  if (new Set(normalized.map((row) => row.timestamp)).size !== normalized.length)
    invalidEvidence("Duplicate evidence timestamps require reconciliation.");
  return normalized.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function evidenceCadenceWarnings(rows: { timestamp: string }[]) {
  if (rows.length < 4)
    return ["At least four observations are required for historical assessment."];
  const gaps = rows
    .slice(1)
    .map((row, i) => Date.parse(row.timestamp) - Date.parse(rows[i].timestamp));
  return gaps.some((gap) => gap !== gaps[0])
    ? ["Irregular evidence intervals: continuous coverage and forecasting are not established."]
    : [];
}
