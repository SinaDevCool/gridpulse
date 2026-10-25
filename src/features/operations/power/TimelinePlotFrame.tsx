import type { ReactNode } from "react";

/** Gives ResponsiveContainer a bounded plot area below the panel header/legend. */
export function TimelinePlotFrame({ modelled, children }: { modelled: boolean; children: ReactNode }) {
  return modelled ? <div className="battery-chart-plot">{children}</div> : children;
}
