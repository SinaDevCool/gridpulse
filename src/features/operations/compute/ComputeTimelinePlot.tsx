import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartVisibility } from "../visualization";
import { formatOperationsTime } from "../presentation";
import { ComputeTooltip } from "./ComputeChartData";
import type { selectComputeTimeline } from "./select-compute-timeline";

export function ComputeTimelinePlot({
  data,
  from,
  to,
  timestamp,
  facilityContext,
  target,
  limit,
  visibility,
  onSelect,
  previewing = false,
}: {
  data: ReturnType<typeof selectComputeTimeline>;
  from: number;
  to: number;
  timestamp: number;
  facilityContext: boolean;
  target: number;
  limit: number;
  visibility: ChartVisibility;
  onSelect: (timestamp: string) => void;
  previewing?: boolean;
}) {
  const ceiling = facilityContext
    ? Math.max(limit, ...data.map((p) => p.baselineDemandMw))
    : Math.max(1, ...data.map((p) => p.requiredWorkloadMw));
  return (
    <div
      className="operations-v2-chart compute-timeline"
      role="group"
      aria-label="Required workload reduction and candidate windows share the same time axis"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 18, left: 0, bottom: 4 }}
          accessibilityLayer
          throttledEvents={[]}
          onClick={(state) => {
            const point = data.find((p) => p.time === Number(state.activeLabel));
            if (point) onSelect(point.timestamp);
          }}
        >
          <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
          <XAxis
            type="number"
            dataKey="time"
            domain={[from, to]}
            ticks={Array.from({ length: 5 }, (_, i) => from + ((to - from) * i) / 4)}
            tickFormatter={(value) =>
              formatOperationsTime(new Date(value).toISOString()) +
              (new Date(value).getUTCDate() !== new Date(from).getUTCDate() ? " +1d" : "")
            }
            minTickGap={50}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={60}
            unit=" MW"
            tickLine={false}
            axisLine={false}
            domain={[0, Math.ceil(ceiling * 1.1)]}
          />
          <Tooltip
            content={<ComputeTooltip />}
            labelFormatter={(value) => formatOperationsTime(new Date(Number(value)).toISOString())}
          />
          {data
            .filter(
              (p) =>
                p.requiredWorkloadMw > 0 &&
                visibility.visible(facilityContext ? "Facility demand" : "Required after battery"),
            )
            .map((p) => (
              <ReferenceArea
                key={p.time}
                x1={p.time}
                x2={Math.min(to, p.end)}
                fill="var(--ops-target)"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            ))}
          <ReferenceLine
            x={timestamp}
            stroke="var(--ops-text)"
            strokeDasharray={previewing ? "3 3" : undefined}
          />
          {!facilityContext ? (
            <Area
              dataKey="requiredWorkloadMw"
              name="Required after battery"
              hide={!visibility.visible("Required after battery")}
              stroke="var(--ops-response)"
              fill="var(--ops-demand-fill)"
              strokeWidth={3}
              isAnimationActive={false}
            />
          ) : (
            <>
              <ReferenceLine
                y={target}
                stroke="var(--ops-target)"
                strokeDasharray="3 5"
                strokeOpacity={visibility.visible("Safety target") ? 1 : 0}
              />
              <ReferenceLine
                y={limit}
                stroke="var(--ops-limit)"
                strokeDasharray="7 5"
                strokeOpacity={visibility.visible("Facility limit") ? 1 : 0}
              />
              <Area
                dataKey="baselineDemandMw"
                name="Facility demand"
                hide={!visibility.visible("Facility demand")}
                stroke="var(--ops-demand)"
                fill="var(--ops-demand-fill)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                dataKey="gpuPowerMw"
                name="GPU power"
                hide={!visibility.visible("GPU power")}
                stroke="var(--ops-compute)"
                strokeDasharray="4 3"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                dataKey="combinedDemandMw"
                name="Aggregate scenario response"
                hide={!visibility.visible("Aggregate scenario response")}
                stroke="var(--ops-response)"
                dot={false}
                strokeWidth={3}
                isAnimationActive={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
