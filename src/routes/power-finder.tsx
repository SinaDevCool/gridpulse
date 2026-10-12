import { createFileRoute } from "@tanstack/react-router";
import { FinderScreen } from "./../features/power-finder/FinderScreen";
import { useFinderController } from "./../features/power-finder/use-finder-controller";

import { finderSearchSchema } from "@/features/power-finder/search-contract";

export const Route = createFileRoute("/power-finder")({
  validateSearch: finderSearchSchema,
  head: () => ({
    meta: [
      { title: "Power Finder | GridPulse" },
      {
        name: "description",
        content:
          "Screen German grid nodes, mapped voltage, industrial sites and source evidence without creating an account.",
      },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/power-finder" }],
  }),
  component: PowerFinderPage,
});

function PowerFinderPage() {
  return <FinderScreen model={useFinderController()} />;
}
