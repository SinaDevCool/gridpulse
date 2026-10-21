import { useEffect, useState } from "react";
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
import type { ComputeWorkspaceContract } from "../compute-workspace-contract";
import { ComputeChartData, ComputeTooltip } from "./ComputeChartData";
import { OperationsChartLegend } from "../visualization";
import { OperationsEvidenceBadge } from "../components";
import { formatOperationsTime } from "../presentation";
import { formatMw } from "../formatting";
import { WorkloadWindowLanes } from "./WorkloadWindowLanes";

export function ComputeTimeline({ workspace }: { workspace: ComputeWorkspaceContract }) {
  const { displayModel, model, assessment, selectedId, setSelectedId } = workspace;
  const [index, setIndex] = useState(0);
  const [showGpu, setShowGpu] = useState(false);
  const [showAggregate, setShowAggregate] = useState(false);
  const [showEligible, setShowEligible] = useState(false);
  const points = displayModel.intervals;
  const data = points.map((point) => ({ ...point, time: Date.parse(point.timestamp) }));
  const from = data[0].time,
    to = data.at(-1)!.time + 15 * 60_000;
  const currentIndex = Math.min(index, points.length - 1);
  const current = data[currentIndex];
  useEffect(() => setIndex(0), [from, to]);
  const target = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const pool = assessment.decisions.filter(
    (job) => job.recommended || (showEligible && job.eligible),
  );
  const jobs = pool.slice(0, 5);
  const inspected = assessment.decisions.find((job) => job.workloadId === selectedId);
  if (inspected && !jobs.some((job) => job.workloadId === inspected.workloadId))
    jobs.push(inspected);
  return (
    <article className="operations-v2-chart-card compute-integrated-workspace">
      <header className="operations-v2-chart-header">
        <div>
          <p className="context-label">Power & workload workspace</p>
          <h3>Compute Demand and Facility Limit</h3>
        </div>
        <OperationsEvidenceBadge kind="simulated" />
      </header>
      <p className="operations-chart-purpose">
        Selected display window · shaded periods exceed the baseline safety target. Candidate
        eligibility and recovery use the full horizon. Eligibility is not a validated recovery
        schedule.
      </p>
      <details className="compute-chart-options">
        <summary>Chart options</summary>
        <label>
          <input
            type="checkbox"
            checked={showGpu}
            onChange={(event) => setShowGpu(event.target.checked)}
          />
          Show GPU power
        </label>
        <label>
          <input
            type="checkbox"
            checked={showAggregate}
            onChange={(event) => setShowAggregate(event.target.checked)}
          />
          Show aggregate scenario response—not a candidate-job schedule
        </label>
      </details>
      <OperationsChartLegend
        items={[
          {
            label: "Facility demand",
            detail: "MW · before response",
            tone: "demand",
            mark: "area",
          },
          {
            label: "Safety target",
            detail: `${formatMw(target)} · assumption`,
            tone: "target",
            mark: "dash",
          },
          {
            label: "Facility limit",
            detail: `${formatMw(model.scenario.importLimitMw)} · assumption`,
            tone: "limit",
            mark: "dash",
          },
          ...(showGpu
            ? [
                {
                  label: "GPU power",
                  detail: "MW · component of facility demand",
                  tone: "compute" as const,
                },
              ]
            : []),
          ...(showAggregate
            ? [
                {
                  label: "Aggregate scenario response",
                  detail: "MW · not a job schedule",
                  tone: "response" as const,
                },
              ]
            : []),
        ]}
      />
      <div
        className="operations-v2-chart compute-timeline"
        role="img"
        aria-label="Facility demand and constrained periods aligned with declared workload windows"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
            onClick={(state) => {
              if (state.activeTooltipIndex != null)
                setIndex(
                  Math.max(0, Math.min(points.length - 1, Number(state.activeTooltipIndex))),
                );
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
              domain={[
                0,
                Math.ceil(
                  Math.max(
                    model.scenario.importLimitMw * 1.15,
                    ...points.map((point) => point.baselineDemandMw),
                  ) / 10,
                ) * 10,
              ]}
            />
            <Tooltip
              content={<ComputeTooltip />}
              labelFormatter={(value) =>
                formatOperationsTime(new Date(Number(value)).toISOString())
              }
            />
            {data
              .filter((point) => point.baselineDemandMw > target)
              .map((point) => (
                <ReferenceArea
                  key={point.time}
                  x1={point.time}
                  x2={Math.min(to, point.time + 15 * 60_000)}
                  fill="var(--ops-target)"
                  fillOpacity={0.09}
                  strokeOpacity={0}
                />
              ))}
            <ReferenceLine
              y={target}
              stroke="var(--ops-target)"
              strokeDasharray="3 5"
              label={{ value: `${formatMw(target)} target`, position: "insideTopRight" }}
            />
            <ReferenceLine
              y={model.scenario.importLimitMw}
              stroke="var(--ops-limit)"
              strokeDasharray="7 5"
              label={{
                value: `${formatMw(model.scenario.importLimitMw)} limit`,
                position: "insideBottomLeft",
              }}
            />
            <ReferenceLine x={current.time} stroke="var(--ops-muted)" />
            <Area
              dataKey="baselineDemandMw"
              name="Facility demand"
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            {showGpu ? (
              <Line
                dataKey="gpuPowerMw"
                name="GPU power"
                stroke="var(--ops-compute)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            {showAggregate ? (
              <Line
                dataKey="combinedDemandMw"
                name="Aggregate scenario response"
                stroke="var(--ops-response)"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="compute-time-inspector">
        <label htmlFor="compute-inspect-time">
          Inspect time · <strong>{formatOperationsTime(current.timestamp)}</strong>
        </label>
        <input
          id="compute-inspect-time"
          type="range"
          disabled={!workspace.interactive}
          min="0"
          max={points.length - 1}
          value={currentIndex}
          onChange={(event) => setIndex(Number(event.target.value))}
          aria-valuetext={formatOperationsTime(current.timestamp)}
        />
        <span>
          Facility demand {formatMw(current.baselineDemandMw)} · Baseline reduction needed{" "}
          {formatMw(Math.max(0, current.baselineDemandMw - target))}
        </span>
      </div>
      <label className="compute-show-eligible">
        <input
          type="checkbox"
          checked={showEligible}
          onChange={(event) => setShowEligible(event.target.checked)}
        />
        Show eligible workload windows
      </label>
      <WorkloadWindowLanes
        jobs={jobs}
        from={from}
        to={to}
        cursor={current.time}
        onSelect={setSelectedId}
        selectedId={selectedId}
        interactive={workspace.interactive}
      />
      {pool.length > 5 ? (
        <p>
          Showing 5 candidate/eligible windows. Open the workload queue to inspect all {pool.length}
          .
        </p>
      ) : null}
      <ComputeChartData model={displayModel} />
    </article>
  );
}
