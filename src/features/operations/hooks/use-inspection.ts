import { useState } from "react";
import { useOperationsPresentationStore } from "./evidence-store";

/** Inspection is presentation state, never an input to the assessment engine. */
export function useInspection(points: { timestamp: string }[], fallback?: string) {
  const [timestamp, select] = useOperationsPresentationStore().powerTimestamp;
  const [preview, setPreview] = useState<{ points: typeof points; value: string } | null>(null);
  const current =
    points.find((point) => point.timestamp === timestamp)?.timestamp ??
    fallback ??
    points[0]?.timestamp;
  const effective =
    preview?.points === points && points.some((point) => point.timestamp === preview.value)
      ? preview.value
      : current;
  return {
    timestamp: effective,
    pinnedTimestamp: current,
    previewing: effective !== current,
    preview: (value: string | null) => setPreview(value ? { points, value } : null),
    select: (value: string) => {
      setPreview(null);
      select(value);
    },
  };
}
