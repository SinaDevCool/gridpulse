import { ResponsiveContainer, Sankey } from "recharts";
import type { NodeProps, LinkProps } from "recharts/types/chart/Sankey";
import { buildPowerBalanceSankey, type PowerBalancePresentation } from "./power-balance";
import { formatMw } from "./visualization";

function BalanceNode({ x, y, width, height, payload }: NodeProps) {
  const data = payload as typeof payload & { name: string; tone: string; mw: number };
  const right = payload.targetNodes.length === 0;
  const middle = payload.sourceNodes.length > 0 && !right;
  const labelX = middle ? x + width / 2 : right ? x - 10 : x + width + 10;
  const labelY = middle ? y - 26 : y + height / 2 - 6;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={3} fill={`var(--ops-${data.tone})`} />
      <text
        x={labelX}
        y={labelY}
        textAnchor={middle ? "middle" : right ? "end" : "start"}
        className="balance-node-name"
      >
        {data.name}
      </text>
      <text
        x={labelX}
        y={labelY + 18}
        textAnchor={middle ? "middle" : right ? "end" : "start"}
        className="balance-node-value"
      >
        {formatMw(data.mw)}
      </text>
    </g>
  );
}

function BalanceLink({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
}: LinkProps) {
  const sourceTone = (payload.source as typeof payload.source & { tone: string }).tone;
  const tone =
    sourceTone === "battery"
      ? "battery"
      : (payload.target as typeof payload.target & { tone: string }).tone;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={`var(--ops-${tone})`}
      strokeOpacity={0.25}
      strokeWidth={linkWidth}
    />
  );
}

export function PowerBalanceDiagram({
  balance,
  limitMw,
}: {
  balance: PowerBalancePresentation;
  limitMw?: number;
}) {
  const data = buildPowerBalanceSankey(balance);
  const exceedsLimit = limitMw != null && balance.gridMw > limitMw + 0.01;
  if (exceedsLimit)
    data.nodes
      .filter((node) => node.name === "Grid import")
      .forEach((node) => {
        node.tone = "limit";
      });
  return (
    <div className="balance-diagram">
      {data.reconciled && data.links.length ? (
        <div
          className="balance-sankey"
          role="img"
          aria-label="Proportional power flows in MW. The labelled balance below provides the same values."
        >
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={data}
              node={BalanceNode}
              link={BalanceLink}
              nodeWidth={8}
              nodePadding={64}
              iterations={32}
              sort={false}
              margin={{ top: 60, bottom: 28, left: 12, right: 12 }}
            />
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="balance-warning" role="status">
          {balance.batteryMw == null
            ? "Battery evidence unavailable. A reconciled flow cannot be shown."
            : "These readings do not reconcile. Review the boundary and aligned observations before relying on the flow."}
        </p>
      )}
      <dl className="balance-values" aria-label="Power balance values">
        <div className={exceedsLimit ? "balance-limit-breach" : undefined}>
          <dt>Grid import</dt>
          <dd>
            {formatMw(balance.gridMw)}
            {exceedsLimit ? <small>Above {formatMw(limitMw!)} facility limit</small> : null}
          </dd>
        </div>
        <div>
          <dt>Battery · {balance.batteryDirection}</dt>
          <dd>
            {balance.batteryMw == null ? "Unavailable" : formatMw(Math.abs(balance.batteryMw))}
          </dd>
        </div>
        <div>
          <dt>Facility demand</dt>
          <dd>{formatMw(balance.facilityMw)}</dd>
        </div>
        <div>
          <dt>Compute / other</dt>
          <dd>
            {balance.gpuMw == null
              ? "Unavailable"
              : `${formatMw(balance.gpuMw)} / ${formatMw(balance.otherMw ?? 0)}`}
          </dd>
        </div>
      </dl>
      <div className="power-flow-equations">
        <span>
          <strong>Supply balance</strong>
          {balance.batteryMw == null
            ? "Battery contribution unavailable"
            : `${formatMw(balance.gridMw)} ${balance.batteryMw >= 0 ? "+" : "−"} ${formatMw(Math.abs(balance.batteryMw))} ${Math.abs(balance.inputDifferenceMw ?? 0) <= 0.05 ? "≈" : "≠"} ${formatMw(balance.facilityMw)}`}
        </span>
        <span>
          <strong>Load allocation</strong>
          {balance.gpuMw == null
            ? "Sub-load evidence unavailable"
            : `${formatMw(balance.gpuMw)} + ${formatMw(balance.otherMw ?? 0)} ${Math.abs(balance.outputDifferenceMw ?? 0) <= 0.05 ? "≈" : "≠"} ${formatMw(balance.facilityMw)}`}
        </span>
      </div>
      <p className="power-flow-note">
        Ribbon widths are proportional to MW. On small screens, use the labelled balance values.
      </p>
    </div>
  );
}
