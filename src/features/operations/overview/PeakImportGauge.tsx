import { formatMw } from "../formatting";

/** Engine-independent presentation of a returned peak and declared operating limits. */
export function PeakImportGauge({ peak, target, limit, maximum, caption }: {
  peak: number; target: number; limit: number; maximum: number; caption: string;
}) {
  const at = (value: number) => {
    const angle = Math.PI * (1 - value / maximum);
    return { x: 140 + 108 * Math.cos(angle), y: 128 - 108 * Math.sin(angle) };
  };
  return <div className="ops-import-gauge" role="meter" aria-label="Peak import after response"
    aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={peak}
    aria-valuetext={`${formatMw(peak)}; safety target ${formatMw(target)}; facility limit ${formatMw(limit)}; ${caption}`}>
    <svg viewBox="0 0 280 155" aria-hidden="true">
      <path d="M32 128 A108 108 0 0 1 248 128" pathLength="100" className="ops-gauge-track" />
      <path d="M32 128 A108 108 0 0 1 248 128" pathLength="100"
        className={`ops-gauge-value ${peak <= target + .01 ? "" : "over"}`}
        strokeDasharray={`${100 * peak / maximum} 100`} />
      {[{ value: target, tone: "target" }, { value: limit, tone: "limit" }].map(({ value, tone }) =>
        <circle key={tone} cx={at(value).x} cy={at(value).y} r="5" className={`ops-gauge-marker ${tone}`} />)}
      <text x="140" y="103" textAnchor="middle" className="ops-gauge-number">{formatMw(peak)}</text>
      <text x="140" y="126" textAnchor="middle">Peak import after response</text>
      <text x="26" y="152">0</text><text x="254" y="152" textAnchor="end">{formatMw(maximum)}</text>
    </svg>
    <div className="ops-gauge-key"><span>Target <b>{formatMw(target)}</b></span><span>Limit <b>{formatMw(limit)}</b></span></div>
    <small>{caption}</small>
  </div>;
}
