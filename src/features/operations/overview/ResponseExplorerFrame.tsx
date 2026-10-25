import { useState, type ReactNode } from "react";
import { ChartNoAxesCombined, Gauge, ScanLine } from "lucide-react";

/** Shared navigation and layout, not a shared engine or independent inspection store. */
export function ResponseExplorerFrame({ label = "Response explorer", scope, marginsLabel = "Modeled headroom",
  compareLabel = "Compare plans", intervalLabel = "Explain selected interval", compare, interval, margins, children }: {
  label?: string; scope: string; marginsLabel?: string; compareLabel?: string; intervalLabel?: string;
  compare: ReactNode; interval: ReactNode; margins: ReactNode; children?: ReactNode;
}) {
  const [lens, setLens] = useState("compare");
  return <section className="ops-response-explorer" aria-label={label}>
    <header className="ops-explorer-heading"><h3>Response explorer</h3><span>{scope}</span></header>
    <div className="ops-response-selector" role="group" aria-label="Response explorer view">
      {[{ id: "compare", label: compareLabel, Icon: ChartNoAxesCombined },
        { id: "interval", label: intervalLabel, Icon: ScanLine },
        { id: "margins", label: marginsLabel, Icon: Gauge }].map(({ id, label: title, Icon }) =>
        <button type="button" key={id} aria-pressed={lens === id} onClick={() => setLens(id)}>
          <Icon aria-hidden="true" />{title}</button>)}
    </div>
    {lens === "compare" ? compare : lens === "interval" ? interval : margins}
    {children}
  </section>;
}
