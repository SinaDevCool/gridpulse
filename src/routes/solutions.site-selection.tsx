import { createFileRoute } from "@tanstack/react-router";
import { SolutionIntroduction } from "@/components/product/SolutionIntroduction";
export const Route = createFileRoute("/solutions/site-selection")({
  head: () => ({
    meta: [
      { title: "Site Selection | GridPulse" },
      {
        name: "description",
        content:
          "For developers and investors: investigate data-centre locations and grid-connection candidates.",
      },
    ],
  }),
  component: () => <SolutionIntroduction id="planning" />,
});
