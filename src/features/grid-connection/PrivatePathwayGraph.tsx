import type { GraphPathway } from "./private-graph-workspace";

const WIDTH = 760;
const HEIGHT = 220;
const PADDING = 54;

function shortLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 15)}…` : value;
}

export default function PrivatePathwayGraph({ pathway }: { pathway: GraphPathway }) {
  const count = Math.max(pathway.bus_ids.length, 1);
  const step = count > 1 ? (WIDTH - PADDING * 2) / (count - 1) : 0;
  const points = pathway.bus_ids.map((id, index) => ({
    id,
    x: count === 1 ? WIDTH / 2 : PADDING + index * step,
    y: HEIGHT / 2,
  }));

  return (
    <figure className="private-graph-canvas" aria-labelledby="private-pathway-graph-title">
      <figcaption id="private-pathway-graph-title" className="sr-only">
        Bounded topology view of the selected candidate pathway, containing {points.length} buses
        and {pathway.asset_ids.length} connecting assets.
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-describedby="private-pathway-graph-description"
        preserveAspectRatio="xMidYMid meet"
      >
        <desc id="private-pathway-graph-description">
          The graph runs from the declared site-side bus on the left to the candidate connection bus
          on the right. It is a topology trace, not an electrical capacity result.
        </desc>
        {points.slice(0, -1).map((point, index) => {
          const next = points[index + 1];
          return (
            <g key={`${point.id}-${next.id}`}>
              <line
                className="private-graph-edge"
                x1={point.x}
                y1={point.y}
                x2={next.x}
                y2={next.y}
              />
              <text
                className="private-graph-edge-label"
                x={(point.x + next.x) / 2}
                y={point.y - 18}
              >
                {shortLabel(pathway.asset_ids[index] ?? `asset ${index + 1}`)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const endpoint = index === 0 || index === points.length - 1;
          return (
            <g key={point.id}>
              <circle
                className={
                  index === 0
                    ? "private-graph-node site"
                    : endpoint
                      ? "private-graph-node candidate"
                      : "private-graph-node"
                }
                cx={point.x}
                cy={point.y}
                r={endpoint ? 15 : 11}
              />
              <text
                className="private-graph-node-label"
                x={point.x}
                y={point.y + 35}
                textAnchor="middle"
              >
                {shortLabel(point.id)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
