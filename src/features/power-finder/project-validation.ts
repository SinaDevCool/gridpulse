export const finderLimits = {
  latitude: { min: 47, max: 56, label: "Latitude" },
  longitude: { min: 5, max: 16, label: "Longitude" },
  importMw: { min: 0.1, max: 1000, label: "Import MW" },
  exportMw: { min: 0, max: 1000, label: "Export MW" },
  batteryPowerMw: { min: 0, max: 1000, label: "Battery MW" },
  batteryEnergyMwh: { min: 0, max: 10000, label: "Battery MWh" },
} as const;

export type FinderNumericField = keyof typeof finderLimits;

export function validateFinderNumber(field: FinderNumericField, raw: string) {
  const limit = finderLimits[field];
  if (!raw.trim()) return { value: null, error: `${limit.label} is required.` };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
    return {
      value: null,
      error: `${limit.label} must be between ${limit.min} and ${limit.max}.`,
    };
  }
  return { value, error: null };
}

export function safeFinderValue(
  field: FinderNumericField,
  value: unknown,
  fallback: number | null,
) {
  const result = validateFinderNumber(field, String(value ?? ""));
  return result.error ? fallback : result.value;
}
