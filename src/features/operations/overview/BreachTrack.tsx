import { formatDurationHours } from "../formatting";

/** One renderer for scenario and canonical elapsed-time breaches. */
export function BreachTrack({ spans, first, duration, label, onSelect }: {
  spans: { start: number; end: number; timestamp: string; minutes: number }[];
  first: number; duration: number; label: string; onSelect: (time: string) => void;
}) {
  return <div className="ops-impact-track">{spans.map(span => <button key={span.timestamp} type="button" className="breach"
    style={{ left: `${(span.start - first) / duration * 100}%`, width: `${(span.end - span.start) / duration * 100}%` }}
    aria-label={`${label} breach at ${new Date(span.timestamp).toISOString().slice(11, 16)} UTC · ${formatDurationHours(span.minutes / 60)}`}
    onClick={() => onSelect(span.timestamp)} />)}</div>;
}
