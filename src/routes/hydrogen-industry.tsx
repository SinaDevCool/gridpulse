import { createFileRoute } from "@tanstack/react-router";
import { SectorPage } from "@/components/public/SectorPage";

export const Route = createFileRoute("/hydrogen-industry")({
  head: () => ({
    meta: [
      { title: "Grid Intelligence for Hydrogen & Industry | GridPulse" },
      {
        name: "description",
        content:
          "Screen grid connection candidates and flexible load strategies for hydrogen and industrial projects.",
      },
    ],
  }),
  component: () => <SectorPage content={content} />,
});

const content = {
  eyebrow: "Grid Intelligence for Hydrogen & Industry",
  title: "Turn flexible demand into a more credible route to grid capacity.",
  lead: "Compare industrial connection candidates, separate process-critical demand from flexible production and assess how an hourly envelope changes project feasibility.",
  decision:
    "Match a high-load project to a location and production strategy that can respond to grid conditions.",
  projectType: "hydrogen",
  metrics: [
    { value: "15", label: "Calculated Berlin nodes" },
    { value: "236,520", label: "Hourly states evaluated" },
    { value: "40%", label: "Graph-guided compute reduction" },
  ],
  questions: [
    {
      title: "Which location deserves engineering effort?",
      body: "Shortlist sites using network context, industrial land and transparent evidence before commissioning detailed studies.",
    },
    {
      title: "How much demand is flexible?",
      body: "Separate minimum stable process load from electrolyser, charging or production demand that can be scheduled.",
    },
    {
      title: "When does the constraint occur?",
      body: "Use hourly scenarios to expose restriction frequency, duration and the flexibility required to remain inside the envelope.",
    },
  ],
  strategy: [
    "Define the minimum stable process load before sizing flexibility.",
    "Compare annual restriction exposure—not only a single peak value.",
    "Use operator-confirmed limits before enabling automated control.",
  ],
} as const;
