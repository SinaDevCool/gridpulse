import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMw, formatPercent } from "../formatting";
import {
  OperationsChartLegend,
  OperationsTooltipShell,
  TooltipRow,
  useChartVisibility,
} from "../visualization";

import { number, type EvidenceMode } from "./presentation";
import { formatOperationsTime } from "../presentation";
import { type BatteryTimelinePoint } from "./select-battery-workspace";
import { BatteryConstraintStrip } from "./BatteryConstraintStrip";
import { timelineLegend } from "./timeline-legend";
import { extendStepHorizon, timelineSelection, type TimelineSelection } from "./timeline-presentation";
import { powerPeakMarkers } from "../overview/demand-peak-markers";

const numericAxisProps = {
  tickLine: false,
  axisLine: false,
  tickFormatter: (value: number) => number.format(value),
};

export function PowerTimeline({
  data,
  limitMw,
  targetMw,
  selectedTimestamp,
  onSelect,
  protectedSocPercent,
  mode,
  previewing = false,
  variant = "battery",
  showConstraints = true,
  maximumSocPercent,
  overviewPresentation = false,
}: {
  data: BatteryTimelinePoint[];
  limitMw: number;
  targetMw: number;
  selectedTimestamp: string | null;
  onSelect: (timestamp: string) => void;
  protectedSocPercent: number;
  mode: EvidenceMode;
  previewing?: boolean;
  variant?: "battery" | "overview" | "compute";
  showConstraints?: boolean;
  maximumSocPercent?: number;
  overviewPresentation?: boolean;
}) {
  const selectedLabel = selectedTimestamp;
  const cursorProps = {
    x: selectedLabel ?? undefined,
    stroke: "var(--ops-selection)",
    strokeDasharray: previewing ? "4 4" : undefined,
  };
  const overview = overviewPresentation && variant === "overview";
  const visibility = useChartVisibility(overview ? ["Facility demand"] : []);
  const chartData = overview ? extendStepHorizon(data) : data;
  function selectChart(state: TimelineSelection) {
    const time = timelineSelection(state, data);
    if (time) onSelect(time);
  }
  return (
    <div
      className={`power-timeline power-timeline--${variant}`}
      role="group"
      aria-label={variant === "battery" ? "Three aligned charts show facility demand and grid import in megawatts, battery dispatch in megawatts, and state of charge in percent" : variant === "compute" ? "Workload power and planned facility import in megawatts" : "Baseline and planned facility import comparison in megawatts"}
    >
      <OperationsChartLegend
        visibility={visibility}
        items={timelineLegend(variant, mode)}
      />
      <section className="power-timeline-panel power-timeline-panel--facility">
        <header>
          <strong>{variant === "compute" ? "Workload power & facility context" : "Facility Power"}</strong>
          <span>MW</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            syncId="battery-response-timeline"
            syncMethod="value"
            throttledEvents={[]}
            onClick={selectChart}
            margin={{ top: 18, right: 18, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="timestamp" hide={variant === "battery"}
              tickFormatter={(value: string) => `${formatOperationsTime(value).replace(" UTC", "")}${overview && value === data.at(-1)?.endTimestamp ? " · end" : ""}`}
              minTickGap={40} tickLine={false} axisLine={false} />
            <YAxis
              {...numericAxisProps}
              domain={[
                0,
                Math.max(
                  limitMw * 1.15,
                  ...data.flatMap((point) => [
                    point.facilityDemandMw ?? 0,
                    point.gridImportMw ?? 0,
                    point.baselineDemandMw ?? 0,
                    point.workloadPowerMw ?? 0,
                  ]),
                ),
              ]}
              unit=" MW"
            />
            <Tooltip content={<PowerTooltip panel="facility" targetMw={targetMw} />} />
            {variant === "overview" ? <Line dataKey="baselineDemandMw" name="Baseline import"
              hide={!visibility.visible("Baseline import")} stroke="var(--ops-demand)" strokeDasharray="6 4"
              dot={false} isAnimationActive={false} type="stepAfter" /> : null}
            {variant === "compute" ? <Line dataKey="workloadPowerMw" name="Workload power"
              hide={!visibility.visible("Workload power")} stroke="var(--ops-battery)" strokeWidth={3}
              dot={false} isAnimationActive={false} type="stepAfter" /> : null}
            {mode === "scenario" ? (
              <ReferenceLine
                y={limitMw}
                strokeOpacity={visibility.visible("Facility limit") ? 1 : 0}
                stroke="var(--ops-limit)"
                strokeDasharray="7 5"
                label={{
                  value: visibility.visible("Facility limit")
                    ? `${number.format(limitMw)} MW limit`
                    : "",
                  fill: "var(--ops-limit)",
                  position: "insideBottomLeft",
                }}
              />
            ) : null}
            {mode === "scenario" ? (
              <ReferenceLine
                y={targetMw}
                strokeOpacity={visibility.visible("Safety target") ? 1 : 0}
                stroke="var(--ops-target)"
                strokeDasharray="3 5"
                label={{
                  value: visibility.visible("Safety target")
                    ? `${number.format(targetMw)} MW target`
                    : "",
                  fill: "var(--ops-target)",
                  position: "insideTopRight",
                }}
              />
            ) : null}
            {mode === "historical" ? (
              <>
                <Line
                  dataKey="limitMw"
                  hide={!visibility.visible("Facility limit")}
                  name="Declared limit"
                  stroke="var(--ops-limit)"
                  strokeDasharray="7 5"
                  dot={false}
                  type="stepAfter"
                  isAnimationActive={false}
                />
                <Line
                  dataKey="targetMw"
                  hide={!visibility.visible("Safety target")}
                  name="Analysis target"
                  stroke="var(--ops-target)"
                  strokeDasharray="3 5"
                  dot={false}
                  type="stepAfter"
                  isAnimationActive={false}
                />
              </>
            ) : null}
            {overview ? powerPeakMarkers(data, point => point.baselineDemandMw ?? 0, point => point.gridImportMw,
              visibility.visible("Baseline import"), visibility.visible("Grid import"), "Plan peak") : null}
            {selectedLabel ? <ReferenceLine {...cursorProps} /> : null}
            <Area
              type={showConstraints ? "linear" : "stepAfter"}
              isAnimationActive={false}
              dataKey="facilityDemandMw"
              hide={!visibility.visible("Facility demand")}
              name="Facility demand"
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={2}
            />
            <Line
              isAnimationActive={false}
              type={showConstraints ? "linear" : "stepAfter"}
              dataKey="gridImportMw"
              hide={!visibility.visible("Grid import")}
              name="Grid import"
              stroke="var(--ops-response)"
              dot={false}
              strokeWidth={3}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
      {variant === "battery" ? <><section className="power-timeline-panel power-timeline-panel--battery">
        <header>
          <strong>Battery Dispatch</strong>
          <span>MW</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            syncId="battery-response-timeline"
            syncMethod="value"
            throttledEvents={[]}
            onClick={selectChart}
            margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              {...numericAxisProps}
              yAxisId="dispatch"
              domain={[
                -Math.max(1, ...data.map((point) => Math.abs(point.batteryPowerMw ?? 0))),
                Math.max(
                  1,
                  ...data.flatMap((point) => [
                    point.batteryPowerMw ?? 0,
                    point.availableDischargeMw ?? 0,
                  ]),
                ),
              ]}
              unit=" MW"
            />
            <Tooltip content={<PowerTooltip panel="battery" targetMw={targetMw} />} />
            <ReferenceLine yAxisId="dispatch" y={0} stroke="var(--ops-axis)" />
            {selectedLabel ? <ReferenceLine yAxisId="dispatch" {...cursorProps} /> : null}
            <Bar
              isAnimationActive={false}
              yAxisId="dispatch"
              dataKey="batteryPowerMw"
              hide={!visibility.visible("Battery dispatch")}
              name="Battery dispatch"
              fill="var(--ops-battery)"
              opacity={0.86}
            />
            <Line
              yAxisId="dispatch"
              dataKey="availableDischargeMw"
              hide={!visibility.visible("Available discharge")}
              name={mode === "scenario" ? "Available discharge" : "Reported discharge allowance"}
              stroke="var(--ops-muted)"
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
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
            syncId="battery-response-timeline"
            syncMethod="value"
            throttledEvents={[]}
            onClick={selectChart}
            margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value: string) => formatOperationsTime(value).replace(" UTC", "")}
              minTickGap={28}
              tickLine={false}
              axisLine={false}
            />
            <YAxis yAxisId="soc" domain={[0, 100]} unit="%" {...numericAxisProps} />
            {maximumSocPercent != null ? <ReferenceLine yAxisId="soc" y={maximumSocPercent}
              stroke="var(--ops-muted)" strokeDasharray="3 4" label={{ value: `Maximum SOC ${number.format(maximumSocPercent)}%`, fill: "var(--ops-muted)", position: "insideTopRight" }} /> : null}
            <Tooltip content={<PowerTooltip panel="battery" targetMw={targetMw} />} />
            {Number.isFinite(protectedSocPercent) && visibility.visible("Protected reserve") ? (
              <>
                <ReferenceArea
                  yAxisId="soc"
                  y1={0}
                  y2={Math.min(100, protectedSocPercent)}
                  fill="var(--ops-target)"
                  fillOpacity={0.12}
                />
                <ReferenceLine
                  yAxisId="soc"
                  y={Math.min(100, protectedSocPercent)}
                  stroke="var(--ops-target)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Protected reserve ${number.format(protectedSocPercent)}% · assumption`,
                    fill: "var(--ops-target)",
                    position: "insideTopLeft",
                  }}
                />
              </>
            ) : null}
            {selectedLabel ? <ReferenceLine yAxisId="soc" {...cursorProps} /> : null}
            <Line
              isAnimationActive={false}
              yAxisId="soc"
              dataKey="socPercent"
              hide={!visibility.visible("State of charge")}
              name="State of charge"
              stroke="var(--ops-soc)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section></> : null}
      {showConstraints ? <BatteryConstraintStrip
        data={data}
        onSelect={onSelect}
        selectedTimestamp={selectedTimestamp}
      /> : null}
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
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: BatteryTimelinePoint;
  }>;
  label?: string;
  panel: "facility" | "battery";
  targetMw: number;
}) {
  if (!active || !payload?.length) return null;
  const importValue = payload.find((item) => item.name === "Grid import")?.value;
  const status =
    panel === "facility" && importValue != null
      ? importValue <= (payload[0]?.payload?.targetMw ?? targetMw)
        ? "Status: Meets the safety target"
        : `Status: ${formatMw(importValue - (payload[0]?.payload?.targetMw ?? targetMw))} above the safety target`
      : undefined;
  return (
    <OperationsTooltipShell label={payload[0]?.payload?.label === "Planning horizon end" ? "Horizon end · last interval value" : label ? formatOperationsTime(label) : ""} status={status}>
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
