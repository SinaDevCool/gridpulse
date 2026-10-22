import { Link } from "@tanstack/react-router";
import { AppShell } from "./AppShell";
import { solutions, type SolutionId } from "@/config/solutions";
import "./solution-introduction.css";

const journeys = {
  planning: {
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
        "Compare power scenarios, inspect workload candidates and examine battery constraints.",
      ],
      [
        "Review the evidence",
        "Check recovery obligations and distinguish scenario assumptions from uploaded measurements.",
      ],
    ],
    entry: "Open Operations scenario",
    boundary:
      "The workspace starts with a synthetic scenario, not live facility control. No site-search project is required. Uploaded evidence is session-only; no equipment commands are sent.",
  },
} as const;

export function SolutionIntroduction({ id }: { id: SolutionId }) {
  const solution = solutions.find((item) => item.id === id)!;
  const journey = journeys[id];
  return (
    <AppShell>
      <main id="main-content" className="solution-introduction">
        <p className="context-label">GridPulse · {solution.label}</p>
        <h1>{journey.question}</h1>
        <p className="solution-introduction-lead">{journey.summary}</p>
        <p>For {solution.audience.toLowerCase()}.</p>
        <ol aria-label={`${solution.label} workflow`}>
          {journey.steps.map(([title, description], index) => (
            <li key={title}>
              <span aria-hidden="true">0{index + 1}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </li>
          ))}
        </ol>
        <p className="solution-introduction-boundary">{journey.boundary}</p>
        <Link to={solution.to} className="primary-button">
          {journey.entry}
        </Link>
      </main>
    </AppShell>
  );
}
