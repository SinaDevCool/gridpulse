import { Activity, AlertTriangle, Clock3 } from "lucide-react";
import type { GridStressForecast } from "./contracts";

export function RegionalGridOutlook({ forecast, compact = false }: { forecast: GridStressForecast | null; compact?: boolean }) {
  if (!forecast || forecast.status === "unavailable") {
    return (
      <section className={`regional-grid-outlook is-unavailable ${compact ? "is-compact" : ""}`} aria-label="Regional grid outlook">
        <Clock3 aria-hidden="true" />
        <div><strong>Day-ahead grid outlook unavailable</strong><p>{forecast?.message ?? "No accepted real-data model prediction has been published yet."}</p></div>
      </section>
    );
  }
  const probability = Math.round((forecast.highStressProbability ?? 0) * 100);
  return (
    <section className={`regional-grid-outlook severity-${forecast.severity} ${compact ? "is-compact" : ""}`} aria-label="Regional grid outlook">
      <Activity aria-hidden="true" />
      <div className="regional-grid-outlook-copy">
        <span className="context-label">Germany · day-ahead operating context</span>
        <strong>{probability}% probability of elevated redispatch</strong>
        <p>{forecast.deliveryDay} · {forecast.confidence} confidence · P50 {Math.round(forecast.redispatchMwhP50 ?? 0).toLocaleString()} MWh / P90 {Math.round(forecast.redispatchMwhP90 ?? 0).toLocaleString()} MWh</p>
        {!compact && forecast.drivers.length > 0 ? <p>Drivers: {forecast.drivers.slice(0, 3).map((driver) => driver.label ?? driver.metric).join(", ")}.</p> : null}
        <small><AlertTriangle aria-hidden="true" /> Regional forecast only—not free capacity or a connection offer.</small>
      </div>
    </section>
  );
}
