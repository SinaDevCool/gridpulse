import { useOperationsPresentationStore } from "./evidence-store";

/** Inspection is presentation state, never an input to the assessment engine. */
export function useInspection(points: { timestamp: string }[], fallback?: string) {
  const [timestamp, select] = useOperationsPresentationStore().powerTimestamp;
  const current =
    points.find((point) => point.timestamp === timestamp)?.timestamp ??
    fallback ??
    points[0]?.timestamp;
  return { timestamp: current, select };
}
