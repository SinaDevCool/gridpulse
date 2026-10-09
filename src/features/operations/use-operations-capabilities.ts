import { useEffect, useState } from "react";
import { fetchOperationsCapabilities } from "@/lib/operations-api";

export type OperationsCapabilities = Awaited<ReturnType<typeof fetchOperationsCapabilities>>;

export function useOperationsCapabilities() {
  const [data, setData] = useState<OperationsCapabilities | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetchOperationsCapabilities()
      .then((next) => {
        if (active) setData(next);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { data, error };
}
