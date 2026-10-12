import { type OperationsOverviewModel } from "../scenario-engine";

export const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function peakInterval(model: OperationsOverviewModel) {
  return model.intervals.reduce(
    (peak, interval) => (interval.baselineDemandMw > peak.baselineDemandMw ? interval : peak),
    model.intervals[0],
  );
}
