/** Display contracts only: calculations remain in the assessment engine. */
export const operationMetricDefinitions = {
  facilityDemand: "Total facility consumption before the response (MW).",
  gridImport: "Net import at the facility boundary after response (MW).",
  facilityLimit: "Customer-declared maximum import (MW), not independently verified capacity.",
  safetyTarget: "Facility import limit minus the configured reserve (MW).",
  responseDuration: "Sum of assessed intervals with battery discharge; not continuous endurance.",
  batteryEndurance: "Estimated remaining energy above reserve divided by selected discharge power.",
} as const;

export function formatOperationsTime(timestamp: string, includeDate = false) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      ...(includeDate ? ({ day: "2-digit", month: "short", year: "numeric" } as const) : {}),
    }).format(date) + " UTC"
  );
}

export function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  return rounded >= 60
    ? `${Math.floor(rounded / 60)} h${rounded % 60 ? ` ${rounded % 60} min` : ""}`
    : `${rounded} min`;
}

export function importThresholds(gridMw: number | null, limitMw: number, reserveMw: number) {
  return {
    limitExceedanceMw: gridMw == null ? null : Math.max(0, gridMw - limitMw),
    targetShortfallMw: gridMw == null ? null : Math.max(0, gridMw - (limitMw - reserveMw)),
  };
}
