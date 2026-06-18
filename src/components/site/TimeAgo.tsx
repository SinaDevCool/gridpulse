import { useMounted } from "@/hooks/use-mounted";
import { formatMinutesAgo } from "@/lib/gridpulse-data";

// Client-only relative time renderer to avoid SSR/CSR hydration mismatch.
export function TimeAgo({ minutesAgo, prefix }: { minutesAgo: number; prefix?: string }) {
  const mounted = useMounted();
  if (!mounted) return <span className="opacity-60">—</span>;
  return <>{prefix ?? ""}{formatMinutesAgo(minutesAgo)}</>;
}
