import { formatMw } from "../formatting";
import type { selectOperatingSummary } from "./select-operating-summary";

/** Signed waterfall: charging/recovery add demand, discharge/shifting remove it. */
export function SignedResponseDiagram({
  summary: s,
}: {
  summary: ReturnType<typeof selectOperatingSummary>;
}) {
  const baseline = s.peak.baselineDemandMw;
  const afterBattery = baseline - s.battery;
  const afterWorkload = afterBattery - s.workload;
  const reconstructed = afterWorkload + s.recovery;
  const actual = baseline - s.response;
  const steps = [
    { label: "Baseline", start: 0, end: baseline, value: baseline, total: true },
    {
      label: s.battery < 0 ? "Battery charge" : "Battery discharge",
      start: baseline,
      end: afterBattery,
      value: -s.battery || 0,
      total: false,
    },
    {
      label: "Workload reduction",
      start: afterBattery,
      end: afterWorkload,
      value: -s.workload || 0,
      total: false,
    },
    {
      label: "Recovery load",
      start: afterWorkload,
      end: reconstructed,
      value: s.recovery,
      total: false,
    },
    { label: "Grid import", start: 0, end: actual, value: actual, total: true },
  ];
  const maximum = Math.max(1, ...steps.flatMap((step) => [step.start, step.end])) * 1.15;
  const minimum = Math.min(0, ...steps.flatMap((step) => [step.start, step.end]));
  const y = (value: number) => 150 - ((value - minimum) / (maximum - minimum)) * 120;
  return (
    <figure className="ops-waterfall">
      <div
        className="ops-waterfall-scroll"
        role="region"
        aria-label="Selected interval waterfall"
        tabIndex={0}
      >
        <svg
          viewBox="0 0 680 200"
          role="img"
          aria-label={`Selected interval power balance: ${steps.map((step) => `${step.label} ${formatMw(step.value)}`).join(", ")}. Positive effects increase grid import; negative effects reduce it.`}
        >
          <line x1="10" x2="670" y1={y(0)} y2={y(0)} stroke="var(--ops-chart-grid)" />
          {steps.map((step, index) => {
            const x = 14 + index * 134;
            return (
              <g key={step.label}>
                {index > 0 && index < 4 ? (
                  <line
                    x1={x - 32}
                    x2={x}
                    y1={y(step.start)}
                    y2={y(step.start)}
                    stroke="var(--ops-chart-grid)"
                    strokeDasharray="3 3"
                  />
                ) : null}
                <rect
                  x={x}
                  y={Math.min(y(step.start), y(step.end))}
                  width="98"
                  height={Math.max(2, Math.abs(y(step.start) - y(step.end)))}
                  rx="3"
                  fill={
                    step.total
                      ? "var(--ops-demand)"
                      : step.value > 0
                        ? "var(--ops-target)"
                        : "var(--ops-response)"
                  }
                />
                <text
                  x={x + 49}
                  y={Math.min(y(step.start), y(step.end)) - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="15"
                  fontWeight="600"
                >
                  {!step.total && step.value > 0 ? "+" : ""}
                  {formatMw(step.value)}
                </text>
                <text x={x + 49} y="180" textAnchor="middle" fill="currentColor" fontSize="12.5">
                  {step.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption>
        Same-interval power balance · negative effects reduce import; charging and recovery increase
        it.
      </figcaption>
      {Math.abs(reconstructed - actual) > 0.1 ? (
        <p role="status">
          Balance discrepancy: {formatMw(reconstructed - actual)}. Inspect the assessment before
          relying on this response.
        </p>
      ) : null}
    </figure>
  );
}
