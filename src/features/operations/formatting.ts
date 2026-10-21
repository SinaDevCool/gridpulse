export const formatMw = (value: number) => `${formatDecimal(value)}\u00a0MW`;

export const formatMwh = (value: number) => `${formatDecimal(value)}\u00a0MWh`;

export const formatPercent = (value: number) => `${formatDecimal(value)}%`;

export const formatGpuCount = (value: number) =>
  `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} GPU${value === 1 ? "" : "s"}`;

export function formatDurationFromIntervals(intervals: number, minutes = 15) {
  return formatDurationHours((intervals * minutes) / 60);
}

export function formatDurationHours(value: number) {
  const total = Math.max(0, Math.round(value * 60));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder}\u00a0min`;
  if (!remainder) return `${hours}\u00a0h`;
  return `${hours}\u00a0h ${remainder}\u00a0min`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}
