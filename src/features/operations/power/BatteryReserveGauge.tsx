import type { ReactNode } from "react";
import { number } from "./presentation";

/** Display only: callers provide their own Scenario, observed or canonical accounting. */
export function BatteryReserveGauge({ soc, protectedSoc, maximumSoc, children }: {
  soc: number | null; protectedSoc: number; maximumSoc: number; children: ReactNode;
}) {
  return <div className="battery-reserve-gauge" role="img"
    aria-label={soc == null ? "Battery state of charge unavailable" : `Battery state of charge ${number.format(soc)} percent`}>
    <span className="battery-reserve-reading"><strong>{soc == null ? "—" : number.format(soc)}</strong>
      <small>{soc == null ? "Unavailable" : "% SOC"}</small></span>
    <div className="battery-reserve-track" aria-hidden="true">
      <i className="battery-reserve-fill" style={{ width: `${Math.max(0, Math.min(100, soc ?? 0))}%` }} />
      <i className="battery-reserve-protected" style={{ width: `${Math.min(100, protectedSoc)}%` }} />
      <i className="battery-reserve-marker" style={{ left: `${Math.min(100, protectedSoc)}%` }} />
      <i className="battery-reserve-marker maximum" style={{ left: `${maximumSoc}%` }} />
    </div><p className="power-flow-note">{children}</p>
  </div>;
}
