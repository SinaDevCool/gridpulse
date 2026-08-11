import { createFileRoute } from "@tanstack/react-router";
import { SectorPage } from "@/components/public/SectorPage";

export const Route = createFileRoute("/energy-storage")({
  head: () => ({
    meta: [
      { title: "Grid Intelligence for Energy Storage | GridPulse" },
      {
        name: "description",
        content:
          "Screen import and export connection candidates for battery storage projects in Germany.",
      },
    ],
  }),
  component: () => <SectorPage content={content} />,
});

const content = {
  eyebrow: "Grid Intelligence for Energy Storage",
  title: "Find where storage can strengthen the connection case—not just occupy it.",
  lead: "Screen both import and export conditions, identify binding grid pathways and carry a selected battery strategy into activation and operational monitoring.",
  decision:
    "Choose a node and operating profile that respects both charging and discharging constraints.",
  projectType: "battery_storage",
  metrics: [
    { value: "2-way", label: "Import and export screening" },
    { value: "32", label: "N-1 cases in the Berlin model" },
    { value: "0", label: "False-safe cases in validation" },
  ],
  questions: [
    {
      title: "Can the site import and export?",
      body: "Evaluate both directions instead of treating a storage connection as a conventional one-way demand project.",
    },
    {
      title: "Which contingency binds?",
      body: "Trace the network pathway and expose the line, transformer or voltage constraint that limits the opportunity.",
    },
    {
      title: "What response is required?",
      body: "Turn conditional capacity into an explicit charging, discharging and state-of-charge operating strategy.",
    },
  ],
  strategy: [
    "Compare import and export headroom independently.",
    "Preserve the binding contingency with every capacity result.",
    "Monitor the frozen envelope and simulated restriction response together.",
  ],
} as const;
