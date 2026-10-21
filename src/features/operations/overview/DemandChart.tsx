import { useState } from "react";

import {
  Area,
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
  OperationsChartSummary,
  OperationsTooltipShell,
  TooltipRow,
} from "../visualization";

import { ChartHeader } from "./primitives";

import { integer, number } from "./presentation";
import { ResponseControls, ResponseBreakdown } from "./ResponseControls";

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
  const chartData = model.intervals.map((point, index) => {
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
        role="img"
        aria-label="Facility demand scenarios compared with the configured operating limit"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 18, left: 4, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" minTickGap={36} tickLine={false} axisLine={false} />
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
              y={targetMw}
              stroke="var(--ops-target)"
              strokeDasharray="3 5"
              label={{
                value: `${number.format(targetMw)} MW target`,
                fill: "var(--ops-target)",
                position: "insideTopRight",
              }}
            />
            {showUncertainty ? (
              <Line
                dataKey="riskAdjustedCeilingMw"
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
              stroke="var(--ops-limit)"
              strokeDasharray="7 5"
              label={{
                value: `${model.scenario.importLimitMw} MW limit`,
                fill: "var(--ops-limit)",
                position: "insideBottomLeft",
              }}
            />
            {showUncertainty ? (
              <Area
                dataKey="forecastBand"
                name="Planning range"
                stroke="none"
                fill="var(--ops-forecast-fill)"
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            ) : null}
            <Area
              dataKey="baselineDemandMw"
              name="Baseline Demand"
              isAnimationActive={false}
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={2}
            />
            {selected !== "baseline" ? (
              <Line
                dataKey={selectedKey}
                isAnimationActive={false}
                name={selectedName}
                stroke="var(--ops-response)"
                strokeWidth={3}
                dot={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <AccessibleIntervalTable model={model} mode="power" />
      <ResponseBreakdown model={model} selected={selected} />
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
        <OperatingEnvelopeMap model={model} />
      </details>
    </article>
  );
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
    <OperationsTooltipShell label={label}>
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

function AccessibleIntervalTable({
  model,
  mode,
}: {
  model: OperationsOverviewModel;
  mode: "power" | "compute";
}) {
  return (
    <details className="operations-v2-chart-data">
      <summary>View Chart Data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              {mode === "power" ? (
                <>
                  <th scope="col">Baseline (MW)</th>
                  <th scope="col">Battery Response (MW)</th>
                  <th scope="col">Workload Only (MW)</th>
                  <th scope="col">Combined Response (MW)</th>
                </>
              ) : (
                <>
                  <th scope="col">Active GPUs</th>
                  <th scope="col">Utilisation (%)</th>
                  <th scope="col">GPU Power (MW)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {model.intervals.map((point) => (
              <tr key={point.timestamp}>
                <th scope="row">{point.label}</th>
                {mode === "power" ? (
                  <>
                    <td>{number.format(point.baselineDemandMw)} MW</td>
                    <td>{number.format(point.batteryDemandMw)} MW</td>
                    <td>{number.format(point.workloadDemandMw)} MW</td>
                    <td>{number.format(point.combinedDemandMw)} MW</td>
                  </>
                ) : (
                  <>
                    <td>{integer.format(point.activeGpuCount)}</td>
                    <td>{number.format(point.utilizationPercent)}%</td>
                    <td>{number.format(point.gpuPowerMw)} MW</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
