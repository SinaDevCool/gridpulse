import { Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/PublicLayout";
import { SolutionPreview } from "@/components/public/SolutionPreview";
import { solutionContent } from "@/config/solution-content";
import { solutions, type SolutionId } from "@/config/solutions";
import "./solution-introduction.css";
import "@/landing.css";

export function SolutionIntroduction({ id }: { id: SolutionId }) {
  const solution = solutions.find((item) => item.id === id)!;
  const journey = solutionContent[id];
  return (
    <PublicLayout forcePublicChrome solutionMarketingChrome>
      <main id="main-content" className="solution-introduction">
        <p className="context-label">GridPulse · {solution.label}</p>
        <h1>{journey.question}</h1>
        <p className="solution-introduction-lead">{journey.summary}</p>
        <p>For {solution.audience.toLowerCase()}.</p>
        <Link to={solution.to} className="primary-button">
          {journey.entry}
        </Link>
        <ol aria-label={`${solution.label} workflow`}>
          {journey.steps.map(([title, description], index) => (
            <li key={title}>
              <span aria-hidden="true">0{index + 1}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </li>
          ))}
        </ol>
        <SolutionPreview id={id} />
        {id === "operations" ? (
          <details>
            <summary>Explore the workload and battery views</summary>
            <SolutionPreview id={id} view="workloads" />
            <SolutionPreview id={id} view="battery" />
          </details>
        ) : null}
        <p className="solution-introduction-boundary">{journey.boundary}</p>
      </main>
    </PublicLayout>
  );
}
