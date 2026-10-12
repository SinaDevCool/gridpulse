import { fetchOperationsCapabilities } from "@/lib/operations-api";
import { useQuery } from "@tanstack/react-query";

export type OperationsCapabilities = Awaited<ReturnType<typeof fetchOperationsCapabilities>>;

export function useOperationsCapabilities() {
  const query = useQuery({
    queryKey: ["operations", "capabilities"],
    queryFn: ({ signal }) => fetchOperationsCapabilities(signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { data: query.data ?? null, error: query.isError };
}
