import {
  Area,
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

import { useState } from "react";
import { BatteryTimelinePanels } from "./BatteryTimelinePanels";
import { PowerTooltip } from "./PowerTimelineTooltip";
import { batteryChartScales } from "./timeline-scales";
import {
  OperationsChartLegend,
  useChartVisibility,
} from "../visualization";

import { number, type EvidenceMode } from "./presentation";
import { type BatteryTimelinePoint } from "./select-battery-workspace";
import { BatteryConstraintStrip } from "./BatteryConstraintStrip";
import { batteryPanelLegend, timelineLegend } from "./timeline-legend";
import { batteryTimelinePlot, timelineTimeLabel as timeLabel, timelineSelection, type TimelineSelection } from "./timeline-presentation";
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
  batteryBoundaryStates = false,
  onPreview,
}: {
  data: BatteryTimelinePoint[];
  limitMw: number;
  targetMw: number;
  selectedTimestamp: string | null;
  onSelect: (timestamp: string) => void;
  protectedSocPercent: number;
  mode: EvidenceMode;
  previewing?: boolean;
  variant?: "battery" | "overview";
  showConstraints?: boolean;
  maximumSocPercent?: number;
  overviewPresentation?: boolean;
  batteryBoundaryStates?: boolean;
  onPreview?: (timestamp: string | null) => void;
}) {
  const selectedLabel = selectedTimestamp;
  const overview = overviewPresentation && variant === "overview";
  const visibility = useChartVisibility(overview ? ["Facility demand"] : []);
  const [compact, setCompact] = useState(false);
  const plot = batteryTimelinePlot(data, batteryBoundaryStates, selectedTimestamp, previewing, compact, overview);
  const { chartData, timeAxis, cursorProps } = plot;
  const scales = batteryChartScales(data, limitMw, targetMw);
  function selectChart(state: TimelineSelection) {
    const time = timelineSelection(state, data);
    if (time) onSelect(time);
  }
  const previewChart = batteryBoundaryStates && onPreview
    ? (state: TimelineSelection) => onPreview(timelineSelection(state, data) ?? null) : undefined;
  return (
    <div
      className={`power-timeline power-timeline--${variant} ${batteryBoundaryStates ? "power-timeline--modelled" : ""}`}
      role="group"
      aria-label={variant === "battery" ? "Three aligned charts show facility demand and grid import in megawatts, battery dispatch in megawatts, and state of charge in percent" : "Baseline and planned facility import comparison in megawatts"}
    >
      {batteryBoundaryStates ? <div className="battery-chart-toolbar"><span>Three aligned views · UTC</span>
        <button type="button" className="secondary-button" onClick={visibility.reset}>Reset charts</button></div> :
        <OperationsChartLegend visibility={visibility} items={timelineLegend(variant, mode)} />}
      <section className="power-timeline-panel power-timeline-panel--facility">
        <header>
          <strong>{batteryBoundaryStates ? "Grid demand" : "Facility Power"}</strong>
          <span>MW</span>
        </header>
        {batteryBoundaryStates ? <OperationsChartLegend visibility={visibility} showReset={false}
          label="Grid demand legend" items={batteryPanelLegend("facility", false)} /> : null}
        <ResponsiveContainer width="100%" height="100%" onResize={width => setCompact(width < 620)}>
          <ComposedChart
            data={chartData}
            syncId="battery-response-timeline"
            syncMethod="value"
            throttledEvents={[]}
            onClick={selectChart}
            onMouseMove={previewChart}
            onMouseLeave={onPreview ? () => onPreview(null) : undefined}
            margin={{ top: 18, right: 18, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey={batteryBoundaryStates ? "plotTime" : "timestamp"} {...timeAxis} hide={variant === "battery"}
              tickFormatter={(value: string | number) => `${timeLabel(value)}${(overview || batteryBoundaryStates) && (value === data.at(-1)?.endTimestamp || value === Date.parse(data.at(-1)?.endTimestamp ?? "")) ? " · end" : ""}`}
              minTickGap={40} tickLine={false} axisLine={false} />
            <YAxis
              {...numericAxisProps}
              domain={batteryBoundaryStates ? [0, scales.facility.maximum] : [
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
              ticks={batteryBoundaryStates ? scales.facility.ticks : undefined}
              tick={batteryBoundaryStates ? { fill: "var(--ops-muted)", fontSize: 12 } : undefined}
              unit=" MW"
            />
            <Tooltip content={<PowerTooltip panel="facility" targetMw={targetMw} boundaryStates={batteryBoundaryStates} />} />
            {variant === "overview" ? <Line dataKey="baselineDemandMw" name="Baseline import"
              hide={!visibility.visible("Baseline import")} stroke="var(--ops-demand)" strokeDasharray="6 4"
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
            {plot.selectionRange ? <ReferenceArea className="battery-inspection-band" x1={plot.selectionRange[0]} x2={plot.selectionRange[1]} fill="var(--ops-selection)" fillOpacity={.06} /> : null}
            {selectedLabel ? <ReferenceLine {...cursorProps} /> : null}
            <Area
              type={showConstraints ? "linear" : "stepAfter"}
              isAnimationActive={false}
              dataKey="facilityDemandMw"
              hide={!visibility.visible("Facility demand")}
              name="Facility demand"
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={batteryBoundaryStates ? 2.5 : 2}
              strokeDasharray={batteryBoundaryStates ? "6 3" : undefined}
              fillOpacity={batteryBoundaryStates ? .2 : 1}
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
      {variant === "battery" ? <BatteryTimelinePanels plot={plot} visibility={visibility} mode={mode}
        protectedSocPercent={protectedSocPercent} maximumSocPercent={maximumSocPercent} targetMw={targetMw} selectChart={selectChart}
        previewChart={previewChart} clearPreview={onPreview ? () => onPreview(null) : undefined} /> : null}
      {showConstraints ? <BatteryConstraintStrip
        data={chartData}
        onSelect={onSelect}
        selectedTimestamp={selectedTimestamp}
      /> : null}
    </div>
  );
}
