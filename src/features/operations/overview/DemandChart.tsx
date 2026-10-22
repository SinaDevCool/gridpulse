import { useState } from "react";

import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { type OperationsOverviewModel, type OperationsScenarioKind } from "../scenario-engine";

import { formatDurationHours, formatMw } from "../formatting";
import { OperatingEnvelopeMap, ScenarioDecisionTable } from "../OperationsDecision";
import {
  ChartSummaryMetric,
  OperationsChartLegend,
  useChartVisibility,
  OperationsChartSummary,
  OperationsTooltipShell,
  TooltipRow,
} from "../visualization";

import { ChartHeader } from "./primitives";

import { number } from "./presentation";
import { AccessibleIntervalTable } from "./AccessibleIntervalTable";
import { InspectionRange } from "./InspectionRange";
import { ResponseControls, ResponseBreakdown } from "./ResponseControls";
import { IntervalNavigation } from "../inspection";
import { useInspection } from "../hooks/use-inspection";
import { selectOperatingSummary } from "./select-operating-summary";
import { formatOperationsTime } from "../presentation";

export function DemandChart({
  model,
  fullModel = model,
  selected,
  compact = false,
  onSelect,
}: {
  model: OperationsOverviewModel;
  fullModel?: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  compact?: boolean;
  onSelect: (kind: OperationsScenarioKind) => void;
}) {
  const selectedKey =
    selected === "baseline"
      ? "baselineDemandMw"
      : selected === "battery"
        ? "batteryDemandMw"
        : selected === "workload"
          ? "workloadDemandMw"
          : "combinedDemandMw";
  const baseline = model.summaries[0];
  const selectedSummary =
    model.summaries.find((summary) => summary.kind === selected) ?? model.summaries[2];
  const selectedName =
    selected === "baseline"
      ? "Baseline"
      : selected === "battery"
        ? "Battery response"
        : selected === "workload"
          ? "Workload only"
          : "Battery + workload";
  const targetMw = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const [showUncertainty, setShowUncertainty] = useState(false);
  const visibility = useChartVisibility();
  const peak = selectOperatingSummary(model, selected).peak.timestamp;
  const inspection = useInspection(model.intervals, peak);
  const [inspectionRange, setInspectionRange] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const range =
    inspectionRange && inspectionRange.endIndex < model.intervals.length ? inspectionRange : null;
  const inspectionPoints = range
    ? model.intervals.slice(range.startIndex, range.endIndex + 1)
    : model.intervals;
  const chartData = buildDemandChartData(model, targetMw);
  return (
    <article className={`operations-v2-chart-card${compact ? " compact" : ""}`}>
      <ChartHeader eyebrow="24-Hour Scenario" title="Compare power responses" badge="Simulated" />
      <ResponseControls model={model} selected={selected} onSelect={onSelect} />
      <p className="operations-chart-purpose">
        Baseline compared with <strong>{selectedName}</strong>. The safety target preserves the
        configured reserve below the facility limit.
      </p>
      <details className="ops-chart-options">
        <summary>Chart options</summary>
        <label className="operations-chart-option">
          <input
            type="checkbox"
            checked={showUncertainty}
            onChange={(event) => setShowUncertainty(event.target.checked)}
          />
          Show illustrative planning range & risk-adjusted envelope
        </label>
      </details>
      <OperationsChartSummary>
        <ChartSummaryMetric
          label="Peak Reduction"
          value={formatMw(Math.max(0, baseline.peakDemandMw - selectedSummary.peakDemandMw))}
          tone={selectedSummary.feasible ? "positive" : undefined}
        />
        <ChartSummaryMetric
          label="Limit Exposure"
          value={`${formatDurationHours(baseline.violationHours)} → ${formatDurationHours(selectedSummary.violationHours)}`}
          tone={!selectedSummary.feasible ? "limit" : "positive"}
        />
      </OperationsChartSummary>
      <OperationsChartLegend
        visibility={visibility}
        items={[
          {
            label: "Baseline demand",
            detail: "MW · before response",
            tone: "demand",
            mark: "area",
          },
          ...(showUncertainty
            ? [
                {
                  label: "Planning range",
                  detail: "MW · illustrative, not calibrated",
                  tone: "neutral" as const,
                  mark: "area" as const,
                },
              ]
            : []),
          ...(selected !== "baseline"
            ? [{ label: selectedName, detail: "MW · selected response", tone: "response" as const }]
            : []),
          {
            label: "Safety target",
            detail: `${formatMw(targetMw)} · assumption`,
            tone: "target",
            mark: "dash",
          },
          {
            label: "Facility limit",
            detail: `${formatMw(model.scenario.importLimitMw)} · assumption`,
            tone: "limit",
            mark: "dash",
          },
          ...(showUncertainty
            ? [
                {
                  label: "Risk-adjusted envelope",
                  detail: "MW · uncertainty adjusted",
                  tone: "positive" as const,
                  mark: "dash" as const,
                },
              ]
            : []),
        ]}
      />
      <div
        className="operations-v2-chart"
        role="group"
        aria-label="Facility demand scenarios compared with the configured operating limit"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 18, left: 4, bottom: 4 }}
            accessibilityLayer
            throttledEvents={[]}
            onClick={(state) => {
              const point = chartData.find((point) => point.timestamp === state.activeLabel);
              if (point) inspection.select(point.timestamp);
            }}
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value: string) => formatOperationsTime(value)}
              minTickGap={36}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[
                0,
                Math.ceil(
                  Math.max(
                    model.scenario.importLimitMw * 1.15,
                    ...model.intervals.map((point) => point.baselineDemandMw),
                  ) / 10,
                ) * 10,
              ]}
              unit=" MW"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<OperationsTooltip />} />
            <ReferenceLine
              ifOverflow="extendDomain"
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
            {showUncertainty ? (
              <Line
                dataKey="riskAdjustedCeilingMw"
                hide={!visibility.visible("Risk-adjusted envelope")}
                name="Risk-adjusted envelope"
                stroke="var(--ops-positive)"
                strokeWidth={1.5}
                strokeDasharray="2 5"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            <ReferenceLine
              y={model.scenario.importLimitMw}
              strokeOpacity={visibility.visible("Facility limit") ? 1 : 0}
              stroke="var(--ops-limit)"
              strokeDasharray="7 5"
              label={{
                value: visibility.visible("Facility limit")
                  ? `${model.scenario.importLimitMw} MW limit`
                  : "",
                fill: "var(--ops-limit)",
                position: "insideBottomLeft",
              }}
            />
            {showUncertainty ? (
              <Area
                dataKey="forecastBand"
                hide={!visibility.visible("Planning range")}
                name="Planning range"
                stroke="none"
                fill="var(--ops-forecast-fill)"
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            ) : null}
            <Area
              dataKey="baselineDemandMw"
              hide={!visibility.visible("Baseline demand")}
              name="Baseline Demand"
              isAnimationActive={false}
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={2}
            />
            {selected !== "baseline" ? (
              <Line
                dataKey={selectedKey}
                hide={!visibility.visible(selectedName)}
                isAnimationActive={false}
                name={selectedName}
                stroke="var(--ops-response)"
                strokeWidth={3}
                dot={false}
              />
            ) : null}
            <ReferenceLine x={inspection.timestamp} stroke="var(--ops-selection)" />
            {chartData.length > 1 ? (
              <Brush
                dataKey="timestamp"
                tickFormatter={(value: string) => formatOperationsTime(value)}
                fill="var(--ops-demand-fill)"
                stroke="var(--ops-chart-grid)"
                height={24}
                startIndex={range?.startIndex ?? 0}
                endIndex={range?.endIndex ?? model.intervals.length - 1}
                onChange={(next) => {
                  if (next.startIndex != null && next.endIndex != null) {
                    setInspectionRange({ startIndex: next.startIndex, endIndex: next.endIndex });
                    const point = model.intervals.findIndex(
                      (point) => point.timestamp === inspection.timestamp,
                    );
                    if (point < next.startIndex || point > next.endIndex)
                      inspection.select(model.intervals[next.startIndex].timestamp);
                  }
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p>
        Inspection range: {inspectionPoints[0]?.label}–{inspectionPoints.at(-1)?.label} UTC. Peak
        and exposure summaries retain the display window; recovery retains the full planning
        horizon.
      </p>
      <InspectionRange
        model={model}
        range={range}
        setInspectionRange={setInspectionRange}
        inspection={inspection}
      />
      <IntervalNavigation
        points={inspectionPoints}
        timestamp={inspection.timestamp}
        onSelect={inspection.select}
      />
      <button
        type="button"
        onClick={() => {
          setInspectionRange(null);
          inspection.select(peak);
        }}
      >
        Return to peak & reset range
      </button>
      <ResponseBreakdown model={model} selected={selected} timestamp={inspection.timestamp} />
      <AccessibleIntervalTable
        model={{ ...model, intervals: inspectionPoints }}
        mode="power"
        timestamp={inspection.timestamp}
        onSelect={inspection.select}
      />
      <details className="ops-chart-investigation">
        <summary>Compare responses</summary>
        <p>Peak and exposure: selected display window. Recovery: full planning horizon.</p>
        <ScenarioDecisionTable
          model={model}
          fullModel={fullModel}
          selected={selected}
          onSelect={onSelect}
        />
      </details>
      <details className="ops-chart-investigation">
        <summary>Inspect headroom</summary>
        <OperatingEnvelopeMap model={model} timestamp={inspection.timestamp} />
      </details>
    </article>
  );
}

function buildDemandChartData(model: OperationsOverviewModel, targetMw: number) {
  return model.intervals.map((point, index) => {
    const uncertainty = Math.max(0.8, point.baselineDemandMw * (0.018 + index * 0.00008));
    return {
      ...point,
      riskAdjustedCeilingMw:
        model.operatingEnvelope.intervals[index]?.riskAdjustedCeilingMw ?? targetMw,
      forecastBand: [
        Number(Math.max(0, point.baselineDemandMw - uncertainty).toFixed(2)),
        Number((point.baselineDemandMw + uncertainty).toFixed(2)),
      ],
    };
  });
}

function OperationsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <OperationsTooltipShell label={label ? formatOperationsTime(label, true) : ""}>
      {payload.map((item) => (
        <TooltipRow
          key={item.name}
          label={item.name ?? "Series"}
          value={formatMw(item.value ?? 0)}
          tone={item.name === "Baseline Demand" ? "demand" : "response"}
          detail="Simulated"
        />
      ))}
    </OperationsTooltipShell>
  );
}
