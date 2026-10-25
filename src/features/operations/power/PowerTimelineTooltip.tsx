import { formatMw, formatPercent } from "../formatting";
import { OperationsTooltipShell, TooltipRow } from "../visualization";
import { formatOperationsTime } from "../presentation";
import type { BatteryTimelinePoint } from "./select-battery-workspace";

export function PowerTooltip({
  active,
  payload,
  label,
  panel,
  targetMw,
  boundaryStates = false,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: BatteryTimelinePoint;
  }>;
  label?: string | number;
  panel: "facility" | "battery" | "soc";
  targetMw: number;
  boundaryStates?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const importValue = payload.find((item) => item.name === "Grid import")?.value;
  const status =
    panel === "facility" && importValue != null
      ? importValue <= (payload[0]?.payload?.targetMw ?? targetMw)
        ? "Status: Meets the safety target"
        : `Status: ${formatMw(importValue - (payload[0]?.payload?.targetMw ?? targetMw))} above the safety target`
      : undefined;
  const point = payload[0]?.payload;
  const interval = boundaryStates && point?.endTimestamp && point.label !== "Planning horizon end"
    ? `${formatOperationsTime(point.timestamp)}–${formatOperationsTime(point.endTimestamp)}` : null;
  return (
    <OperationsTooltipShell label={interval ?? (payload[0]?.payload?.label === "Planning horizon end" ? "Horizon end · last interval value" : label != null ? formatOperationsTime(typeof label === "number" ? new Date(label).toISOString() : label) : "")} status={status}>
      {payload.map((item) => (
        <TooltipRow
          key={item.name}
          label={boundaryStates && item.name === "Facility demand" ? "Before battery" : boundaryStates && item.name === "Battery dispatch" ? Number(item.value) < 0 ? "Charging" : Number(item.value) > 0 ? "Discharging" : "Idle" : item.name ?? "Series"}
          value={
            item.value == null || !Number.isFinite(item.value) ? "Unavailable" : item.name === "State of charge"
              ? formatPercent(item.value)
              : typeof item.value === "number" ? formatMw(boundaryStates && item.name === "Battery dispatch" ? Math.abs(item.value) : item.value) : "Unavailable"
          }
          tone={
            item.name === "Facility demand"
              ? "demand"
              : item.name === "Grid import"
                ? "response"
                : item.name === "State of charge"
                  ? "soc"
                  : "battery"
          }
          detail={item.name === "State of charge" && boundaryStates ? "SOC at this boundary" : panel === "facility" ? "Facility" : "Battery"}
        />
      ))}
    </OperationsTooltipShell>
  );
}
