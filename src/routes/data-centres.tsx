import { createFileRoute } from "@tanstack/react-router";
import { SectorPage } from "@/components/public/SectorPage";

export const Route = createFileRoute("/data-centres")({
  head: () => ({
    meta: [
      { title: "Grid Intelligence for Data Centres | GridPulse" },
      {
        name: "description",
        content:
          "Screen German grid connection candidates and flexible operating strategies for data centre projects.",
      },
    ],
  }),
  component: () => <SectorPage content={content} />,
});

const content = {
  eyebrow: "Grid Intelligence for Data Centres",
  title: "Make power availability a site-selection decision, not a late-stage surprise.",
  lead: "Compare candidate grid locations, understand firm and flexible capacity, and test how workload and on-site storage could support a connection strategy.",
  decision: "Select a site that can support the critical load and a credible path to full demand.",
  projectType: "data_center",
  metrics: [
    { value: "N-1", label: "Firm-capacity security screen" },
    { value: "8,760", label: "Hourly states per scenario" },
    { value: "5 steps", label: "Discover, qualify, investigate, engage, decide" },
  ],
  questions: [
    {
      title: "Where is the strongest candidate?",
      body: "Compare proximity, voltage, topology, mapped assets and evidence quality around each proposed site.",
    },
    {
      title: "What load can remain firm?",
      body: "Separate the critical always-on baseline from demand that can shift, store or respond to restrictions.",
    },
    {
      title: "How would the site stay compliant?",
      body: "Translate a selected candidate into a governed capacity dossier without obscuring its evidence status.",
    },
  ],
  strategy: [
    "Preserve the firm floor for critical compute and cooling.",
    "Model workload shifting and battery response above the firm floor.",
    "Carry the selected node, constraint and evidence class into operator engagement.",
  ],
} as const;
