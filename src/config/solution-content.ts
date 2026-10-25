import { solutions, type SolutionId } from "./solutions";

export const solutionContent = {
  planning: {
    headline: "Investigate the grid before advancing a site.",
    badge: "Mapped screening evidence",
    question: "Where should we develop?",
    summary:
      "Investigate locations and connection candidates before advancing a data-centre investment.",
    steps: [
      ["Define the brief", "Choose a location, requested import and investigation radius."],
      ["Compare candidates", "Review mapped infrastructure, operator context and source evidence."],
      ["Retain the decision", "Save the shortlist and questions requiring operator confirmation."],
    ],
    entry: "Open Power Finder",
    boundary:
      "Screening is not an offer of connection capacity. No operating facility or workload configuration is required.",
  },
  operations: {
    headline: "Plan batteries and workloads together.",
    badge: "Synthetic MILP demo · read-only",
    question: "How should this facility operate within its power constraints?",
    summary:
      "Assess battery response and workload flexibility together, while exposing reserve limits and unfinished work.",
    steps: [
      [
        "Configure the facility",
        "Set facility limits, battery assumptions and workload flexibility in Inputs & evidence.",
      ],
      [
        "Assess the response",
        "Solve battery and workload plans together, then inspect power, reserve and completion.",
      ],
      [
        "Review the evidence",
        "Check recovery obligations and distinguish scenario assumptions from uploaded measurements.",
      ],
    ],
    entry: "Explore Operations demo",
    boundary:
      "The workspace starts with a synthetic scenario, not live facility control. No site-search project is required. Uploaded evidence is session-only; no equipment commands are sent.",
  },
} as const;

/** Marketing uses the same service availability as application routing. */
export function landingContentFor(ids: readonly SolutionId[]) {
  const available = solutions.filter((solution) => ids.includes(solution.id));
  if (!available.length) throw new Error("At least one solution must be enabled");
  const both = available.length === 2;
  return {
    solutions: available,
    title: both
      ? "GridPulse | Site Selection & Facility Operations"
      : `${available[0].label} | GridPulse`,
    description: both
      ? "Screen grid-connection options and optimise battery and workload plans within modelled power limits."
      : solutionContent[available[0].id].summary,
    headline: both
      ? "Choose the site. Plan the operation."
      : solutionContent[available[0].id].headline,
  };
}
