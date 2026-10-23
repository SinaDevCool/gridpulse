import { useQuery } from "@tanstack/react-query";
import { readOperationsJson } from "../../../lib/operations-request";
import { selectCanonicalDemo } from "../canonical-demo";

export function useCanonicalDemo(enabled: boolean) {
  return useQuery({
    queryKey: ["operations", "synthetic-milp", "assessment-v1"], enabled,
    retry: false, staleTime: Infinity, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await fetch("https://gridpulse-milp-synthetic-pilot.onrender.com/assessment", {
        signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]), credentials: "omit",
      });
      if (!response.ok) throw new Error("Synthetic MILP service unavailable; no heuristic substituted");
      const bounded = new Request("https://synthetic.invalid/result", { method: "POST", body: response.body, duplex: "half" } as RequestInit);
      return selectCanonicalDemo(await readOperationsJson(bounded, 2_000_000));
    },
  });
}
