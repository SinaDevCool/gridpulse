import { useId } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OperationsChartLegend, type ChartVisibility } from "../visualization";
import { number, type EvidenceMode } from "./presentation";
import { batteryPanelLegend } from "./timeline-legend";
import { batteryTimelinePlot, timelineTimeLabel as timeLabel, type TimelineSelection } from "./timeline-presentation";
import { batteryChartScales } from "./timeline-scales";
import { PowerTooltip } from "./PowerTimelineTooltip";
import { TimelinePlotFrame } from "./TimelinePlotFrame";

const numericAxisProps = { tickLine: false, axisLine: false, tickFormatter: (value: number) => number.format(value) };
export function BatteryTimelinePanels({ plot, visibility, mode, protectedSocPercent, maximumSocPercent, targetMw, selectChart, previewChart, clearPreview }: {
  plot: ReturnType<typeof batteryTimelinePlot>; visibility: ChartVisibility; mode: EvidenceMode;
  protectedSocPercent: number; maximumSocPercent?: number; targetMw: number; selectChart: (state: TimelineSelection) => void;
  previewChart?: (state: TimelineSelection) => void; clearPreview?: () => void;
}) {
  const { data, chartData, timeAxis, cursorProps } = plot;
  const batteryBoundaryStates = plot.boundaries, selectedLabel = cursorProps.x != null;
  const scales = batteryChartScales(data, 0, 0);
  const available = data.some(point => point.availableDischargeMw != null && Number.isFinite(point.availableDischargeMw));
  const idle = data.every(point => point.batteryPowerMw === 0);
  const chargePattern = `battery-charge-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return <><section className="power-timeline-panel power-timeline-panel--battery">
        <header>
          <strong>{batteryBoundaryStates ? "Battery power" : "Battery Dispatch"}</strong>
          <span>{batteryBoundaryStates ? "Discharging + / Charging − · MW AC" : "MW"}</span>
        </header>
        {batteryBoundaryStates ? <OperationsChartLegend visibility={visibility} showReset={false}
          label={"Battery power legend"} items={batteryPanelLegend("dispatch", available)} /> : null}
        <TimelinePlotFrame modelled={batteryBoundaryStates}><ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            syncId="battery-response-timeline"
            syncMethod="value"
            throttledEvents={[]}
            onClick={selectChart}
            onMouseMove={previewChart}
            onMouseLeave={clearPreview}
            margin={{ top: 10, right: 18, left: 0, bottom: batteryBoundaryStates ? 14 : 4 }}
            accessibilityLayer
          >
            {batteryBoundaryStates ? <defs><pattern id={chargePattern} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="var(--ops-battery)" fillOpacity=".2" />
              <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" stroke="var(--ops-battery)" strokeWidth="1.3" />
            </pattern></defs> : null}
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey={batteryBoundaryStates ? "plotTime" : "timestamp"} {...timeAxis} hide />
            <YAxis
              {...numericAxisProps}
              yAxisId="dispatch"
              domain={batteryBoundaryStates ? [-scales.dispatch.maximum, scales.dispatch.maximum] : [
                -Math.max(1, ...data.map(point => Math.abs(point.batteryPowerMw ?? 0))),
                Math.max(1, ...data.flatMap(point => [point.batteryPowerMw ?? 0, point.availableDischargeMw ?? 0])),
              ]}
              ticks={batteryBoundaryStates ? scales.dispatch.ticks : undefined}
              tick={batteryBoundaryStates ? { fill: "var(--ops-muted)", fontSize: 12 } : undefined}
              unit={batteryBoundaryStates ? undefined : " MW"}
            />
            <Tooltip content={<PowerTooltip panel="battery" targetMw={targetMw} boundaryStates={batteryBoundaryStates} />} />
            <ReferenceLine yAxisId="dispatch" y={0} stroke="var(--ops-axis)" strokeWidth={batteryBoundaryStates ? 1.5 : 1} />
            {selectedLabel ? <ReferenceLine yAxisId="dispatch" {...cursorProps} /> : null}
            {plot.selectionRange ? <ReferenceArea className="battery-inspection-band" yAxisId="dispatch"
              x1={plot.selectionRange[0]} x2={plot.selectionRange[1]} fill="var(--ops-selection)" fillOpacity={.06} /> : null}
            <Bar
              isAnimationActive={false}
              yAxisId="dispatch"
              dataKey="batteryPowerMw"
              hide={!visibility.visible("Battery dispatch")}
              name="Battery dispatch"
              fill="var(--ops-battery)"
              opacity={batteryBoundaryStates ? 0 : 0.86}
            />
            {batteryBoundaryStates && visibility.visible("Battery dispatch") ? data.filter(point => (point.batteryPowerMw ?? 0) !== 0).map(point =>
              <ReferenceArea className="battery-dispatch-interval" key={point.timestamp} yAxisId="dispatch" x1={Date.parse(point.timestamp)} x2={Date.parse(point.endTimestamp!)}
                y1={0} y2={point.batteryPowerMw!} fill={point.batteryPowerMw! < 0 ? `url(#${chargePattern})` : "var(--ops-battery)"} fillOpacity={1} stroke="var(--ops-battery)" strokeWidth={.6} />) : null}
            <Line
              yAxisId="dispatch"
              dataKey="availableDischargeMw"
              hide={!visibility.visible("Available discharge") || (batteryBoundaryStates && !available)}
              name={mode === "scenario" ? "Available discharge" : "Reported discharge allowance"}
              stroke="var(--ops-muted)"
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer></TimelinePlotFrame>
        {batteryBoundaryStates && idle ? <p className="battery-idle-note" role="status">Battery idle throughout this plan</p> : null}
      </section>
      <section className="power-timeline-panel power-timeline-panel--battery">
        <header>
          <strong>{batteryBoundaryStates ? "Stored energy" : "Battery State of Charge"}</strong>
          <span>SOC %{batteryBoundaryStates && maximumSocPercent != null ? ` · Maximum ${number.format(maximumSocPercent)}%` : ""}</span>
        </header>
        {batteryBoundaryStates ? <OperationsChartLegend visibility={visibility} showReset={false}
          label={"Stored energy legend"} items={batteryPanelLegend("soc", available)} /> : null}
        <TimelinePlotFrame modelled={batteryBoundaryStates}><ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            syncId="battery-response-timeline"
            syncMethod="value"
            throttledEvents={[]}
            onClick={selectChart}
            onMouseMove={previewChart}
            onMouseLeave={clearPreview}
            margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis
              dataKey={batteryBoundaryStates ? "plotTime" : "timestamp"} {...timeAxis}
              tickFormatter={batteryBoundaryStates ? plot.timeLabel : timeLabel}
              minTickGap={30}
              tick={batteryBoundaryStates ? { fill: "var(--ops-muted)", fontSize: 12 } : undefined}
              tickLine={false}
              axisLine={false}
            />
            <YAxis yAxisId="soc" domain={[0, 100]} ticks={batteryBoundaryStates ? [0, 25, 50, 75, 100] : undefined} unit="%" {...numericAxisProps} tick={batteryBoundaryStates ? { fill: "var(--ops-muted)", fontSize: 12 } : undefined} />
            {maximumSocPercent != null ? <ReferenceLine yAxisId="soc" y={maximumSocPercent}
              stroke="var(--ops-muted)" strokeDasharray="3 4" label={batteryBoundaryStates ? undefined : { value: `Maximum SOC ${number.format(maximumSocPercent)}%`, fill: "var(--ops-muted)", position: "insideTopRight" }} /> : null}
            <Tooltip content={<PowerTooltip panel="soc" targetMw={targetMw} boundaryStates={batteryBoundaryStates} />} />
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
            {plot.selectionRange ? <ReferenceArea className="battery-inspection-band" yAxisId="soc" x1={plot.selectionRange[0]} x2={plot.selectionRange[1]} fill="var(--ops-selection)" fillOpacity={.06} /> : null}
            {batteryBoundaryStates && visibility.visible("State of charge") ? [chartData[0], chartData.at(-1)!].filter(Boolean).map((point, index) =>
              point.startingSocPercent != null && point.socPercent != null ? <ReferenceDot key={index} yAxisId="soc"
                x={Date.parse(point.timestamp)} y={index ? point.socPercent : point.startingSocPercent}
                r={3} fill="var(--ops-soc)" stroke="var(--ops-card)"
                label={{ value: `${index ? "End" : "Start"} ${number.format(index ? point.socPercent : point.startingSocPercent)}%`,
                  position: index ? "insideTopRight" : "insideTopLeft", fill: "var(--ops-soc)", fontSize: 12 }} /> : null) : null}
            <Line
              isAnimationActive={false}
              yAxisId="soc"
              dataKey={batteryBoundaryStates ? "boundarySocPercent" : "socPercent"}
              hide={!visibility.visible("State of charge")}
              name="State of charge"
              stroke="var(--ops-soc)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer></TimelinePlotFrame>
      </section>
</>;
}
