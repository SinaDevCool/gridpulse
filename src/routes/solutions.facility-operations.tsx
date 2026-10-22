import { createFileRoute } from "@tanstack/react-router";
import { SolutionIntroduction } from "@/components/product/SolutionIntroduction";
export const Route = createFileRoute("/solutions/facility-operations")({
  head: () => ({
    meta: [
      { title: "Facility Operations | GridPulse" },
      {
        name: "description",
        content:
          "For data-centre energy managers: assess power, battery reserves and workload flexibility independently of site selection.",
      },
    ],
  }),
  component: () => <SolutionIntroduction id="operations" />,
});
