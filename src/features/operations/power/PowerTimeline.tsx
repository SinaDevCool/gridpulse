import {
Area,
Bar,
CartesianGrid,
ComposedChart,
Line,
ReferenceLine,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";

import { formatMw,formatPercent } from "../formatting";
import { OperationsTooltipShell,TooltipRow } from "../visualization";

import { formatOptionalMw,number,valueOf,type EvidenceMode } from "./presentation";

export function PowerTimeline({
  data,
  limitMw,
  targetMw,
  selectedTimestamp,
}: {
  data: unknown[];
  limitMw: number;
  targetMw: number;
  selectedTimestamp: string | null;
}) {
  const selectedLabel = (data as Array<{ timestamp?: string; label?: string }>).find(
    (point) => point.timestamp === selectedTimestamp,
  )?.label;
  return (
    <div
      className="power-timeline"
      role="img"
      aria-label="Three aligned charts show facility demand and grid import in megawatts, battery dispatch in megawatts, and state of charge in percent"
    >
      <section className="power-timeline-panel power-timeline-panel--facility">
        <header>
          <strong>Facility Power</strong>
          <span>MW</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 18, right: 18, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis unit=" MW" tickLine={false} axisLine={false} />
            <Tooltip content={<PowerTooltip panel="facility" targetMw={targetMw} />} />
            <ReferenceLine
              y={limitMw}
              stroke="var(--ops-limit)"
              strokeDasharray="7 5"
              label={{
                value: `${number.format(limitMw)} MW limit`,
                fill: "var(--ops-limit)",
                position: "insideBottomLeft",
              }}
            />
            <ReferenceLine
              y={targetMw}
              stroke="var(--ops-target)"
              strokeDasharray="3 5"
              label={{
                value: `${number.format(targetMw)} MW target`,
                fill: "var(--ops-target)",
                position: "insideTopRight",
              }}
            />
            {selectedLabel ? (
              <ReferenceLine x={selectedLabel} stroke="var(--ops-selection)" />
            ) : null}
            <Area
              dataKey="facilityDemandMw"
              name="Facility demand"
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={2}
            />
            <Line
              dataKey="gridImportMw"
              name="Grid import"
              stroke="var(--ops-response)"
              dot={false}
              strokeWidth={3}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
      <section className="power-timeline-panel power-timeline-panel--battery">
        <header>
          <strong>Battery Dispatch</strong>
          <span>MW</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tickLine={false} axisLine={false} />
            <YAxis yAxisId="dispatch" unit=" MW" tickLine={false} axisLine={false} />
            <Tooltip content={<PowerTooltip panel="battery" targetMw={targetMw} />} />
            <ReferenceLine yAxisId="dispatch" y={0} stroke="var(--ops-axis)" />
            {selectedLabel ? (
              <ReferenceLine yAxisId="dispatch" x={selectedLabel} stroke="var(--ops-selection)" />
            ) : null}
            <Bar
              yAxisId="dispatch"
              dataKey="batteryPowerMw"
              name="Battery dispatch"
              fill="var(--ops-battery)"
              opacity={0.86}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
      <section className="power-timeline-panel power-timeline-panel--battery">
        <header>
          <strong>Battery State of Charge</strong>
          <span>%</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tickLine={false} axisLine={false} />
            <YAxis yAxisId="soc" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
            <Tooltip content={<PowerTooltip panel="battery" targetMw={targetMw} />} />
            {selectedLabel ? (
              <ReferenceLine yAxisId="soc" x={selectedLabel} stroke="var(--ops-selection)" />
            ) : null}
            <Line
              yAxisId="soc"
              dataKey="socPercent"
              name="State of charge"
              stroke="var(--ops-soc)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

function PowerTooltip({
  active,
  payload,
  label,
  panel,
  targetMw,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  panel: "facility" | "battery";
  targetMw: number;
}) {
  if (!active || !payload?.length) return null;
  const importValue = payload.find((item) => item.name === "Grid import")?.value;
  const status =
    panel === "facility" && importValue != null
      ? importValue <= targetMw
        ? "Status: Meets the safety target"
        : `Status: ${formatMw(importValue - targetMw)} above the safety target`
      : undefined;
  return (
    <OperationsTooltipShell label={label} status={status}>
      {payload.map((item) => (
        <TooltipRow
          key={item.name}
          label={item.name ?? "Series"}
          value={
            item.name === "State of charge"
              ? formatPercent(item.value ?? 0)
              : formatMw(item.value ?? 0)
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
          detail={panel === "facility" ? "Facility" : "Battery"}
        />
      ))}
    </OperationsTooltipShell>
  );
}

export function PowerDataTable({
  data,
  onSelect,
  selectedTimestamp,
  mode,
}: {
  data: unknown[];
  onSelect: (value: string) => void;
  selectedTimestamp: string | null;
  mode: EvidenceMode;
}) {
  const rows = data as Array<Record<string, unknown>>;
  return (
    <details className="operations-v2-chart-data">
      <summary>View Full Interval Data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Facility Demand (MW)</th>
              <th scope="col">Battery Dispatch (MW)</th>
              <th scope="col">Grid Import (MW)</th>
              <th scope="col">State of Charge (%)</th>
              <th scope="col">Constraint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={String(row.timestamp)}
                className={selectedTimestamp === row.timestamp ? "selected" : ""}
              >
                <th scope="row">
                  <button type="button" onClick={() => onSelect(String(row.timestamp))}>
                    {String(row.label)}
                  </button>
                </th>
                <td>{formatOptionalMw(valueOf(row, "facilityDemandMw", "baselineDemandMw"))}</td>
                <td>
                  {typeof row.batteryPowerMw === "number"
                    ? `${number.format(row.batteryPowerMw)} MW`
                    : "—"}
                </td>
                <td>{formatOptionalMw(valueOf(row, "gridImportMw", "batteryDemandMw"))}</td>
                <td>
                  {typeof (row.socPercent ?? row.batterySocPercent) === "number"
                    ? `${number.format(Number(row.socPercent ?? row.batterySocPercent))}%`
                    : "—"}
                </td>
                <td>{String(row.batteryConstraintCode ?? "Observed")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
