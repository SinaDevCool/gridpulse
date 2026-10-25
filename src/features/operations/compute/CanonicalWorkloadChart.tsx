import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CanonicalComputeJob, CanonicalComputeModel } from "../canonical-compute";
import { OperationsChartLegend, OperationsTooltipShell, TooltipRow, useChartVisibility } from "../visualization";
import { formatMw } from "../formatting";
import { formatOperationsTime } from "../presentation";
import { timelineSelection, timelineTimeLabel } from "../power/timeline-presentation";

export function CanonicalWorkloadChart({ model: m, selected, timestamp, onSelect }: {
  model: CanonicalComputeModel; selected?: CanonicalComputeJob; timestamp: string; onSelect: (time: string) => void;
}) {
  const visibility = useChartVisibility();
  const rows = m.points.map((point, i) => ({ ...point, selectedMw: selected?.points[i].power_mw ?? null }));
  // Closing step is plot-only, never a 97th solver interval.
  const data = [...rows, { ...rows.at(-1)!, plotTime: m.end }];
  const unknown = m.jobs.some(job => job.protectedWork === null);
  return <section className="canonical-workload-chart" aria-label="Scheduled workload demand">
    <OperationsChartLegend visibility={visibility} items={[
      { label: "Flexible compute", tone: "flexible", mark: "area" },
      { label: "Protected compute", tone: "protected", mark: "area" },
      ...(unknown ? [{ label: "Unclassified compute", tone: "neutral" as const, mark: "area" as const }] : []),
      ...(selected ? [{ label: "Selected workload", detail: "Included in total", tone: "selected" as const }] : []),
    ]} />
    <div className="power-timeline-panel">
      <header><strong>Scheduled workload power</strong><span>MW · flexible + protected = total{unknown ? " (including unclassified)" : ""}</span></header>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}
        margin={{ top: 15, right: 18, bottom: 0, left: 0 }} accessibilityLayer
        onClick={state => { const value = timelineSelection(state, m.points); if (value) onSelect(value); }}>
        <CartesianGrid vertical={false} stroke="var(--ops-chart-grid)" />
        <XAxis dataKey="plotTime" type="number" scale="time" domain={[m.start, m.end]}
          ticks={Array.from({ length: 9 }, (_, index) => m.start + (m.end - m.start) * index / 8)}
          tickFormatter={value => `${timelineTimeLabel(value)}${Number(value) === m.end ? " · end" : ""}`} minTickGap={65} tick={{ fill: "var(--ops-muted)", fontSize: 12 }} />
        <YAxis domain={[0, Math.max(1, ...m.points.map(point => point.workloadPowerMw ?? 0)) * 1.1]} tickLine={false} axisLine={false} tick={{ fill: "var(--ops-muted)", fontSize: 12 }} />
        <Tooltip content={({ label }) => {
          const point = m.points.find(row => Number(label) >= row.plotTime && Number(label) < Date.parse(row.endTimestamp!)) ?? m.points.at(-1)!;
          const i = m.points.indexOf(point);
          return <OperationsTooltipShell label={formatOperationsTime(point.timestamp)}>
            <TooltipRow label="Total workload power" value={formatMw(point.workloadPowerMw ?? 0)} tone="flexible" />
            <TooltipRow label="Flexible compute" value={formatMw(point.flexibleMw)} tone="flexible" />
            <TooltipRow label="Protected compute" value={formatMw(point.protectedMw)} tone="protected" />
            {selected ? <TooltipRow label={selected.name} tone="selected" value={formatMw(selected.points[i].power_mw)}
              detail={`${selected.points[i].gpu_count} GPUs · ${selected.points[i].status} · ${selected.points[i].remaining_work_hours.toFixed(2)} work h remaining`} /> : null}
          </OperationsTooltipShell>;
        }} />
        <Area dataKey="protectedMw" name="Protected compute" stackId="work" type="stepAfter" stroke="var(--ops-protected)"
          fill="var(--ops-protected)" fillOpacity={.35} hide={!visibility.visible("Protected compute")} isAnimationActive={false} />
        <Area dataKey="flexibleMw" name="Flexible compute" stackId="work" type="stepAfter" stroke="var(--ops-flexible)"
          fill="var(--ops-flexible)" fillOpacity={.35} hide={!visibility.visible("Flexible compute")} isAnimationActive={false} />
        {unknown ? <Area dataKey="unknownMw" stackId="work" type="stepAfter" stroke="var(--ops-reference)"
          fill="var(--ops-reference)" hide={!visibility.visible("Unclassified compute")} isAnimationActive={false} /> : null}
        {selected ? <Line dataKey="selectedMw" name="Selected workload" stroke="var(--ops-selected)" strokeWidth={3}
          type="stepAfter" dot={false} hide={!visibility.visible("Selected workload")} isAnimationActive={false} /> : null}
        <ReferenceLine x={Date.parse(timestamp)} stroke="var(--ops-selection)" />
      </ComposedChart></ResponsiveContainer>
    </div>
  </section>;
}
