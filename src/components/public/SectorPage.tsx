import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, MapPin, Network, ShieldCheck, Zap } from "lucide-react";
import { PublicLayout } from "./PublicLayout";
import "../../landing.css";

export type SectorContent = {
  eyebrow: string;
  title: string;
  lead: string;
  decision: string;
  projectType: string;
  metrics: readonly { value: string; label: string }[];
  questions: readonly { title: string; body: string }[];
  strategy: readonly string[];
};

export function SectorPage({ content }: { content: SectorContent }) {
  return (
    <PublicLayout>
      <div className="landing-page sector-page">
        <main id="main-content">
          <section className="sector-hero" aria-labelledby="sector-title">
            <div className="landing-container sector-hero-grid">
              <div className="sector-hero-copy">
                <p className="landing-eyebrow">{content.eyebrow}</p>
                <h1 id="sector-title">{content.title}</h1>
                <p>{content.lead}</p>
                <Link
                  to="/power-finder"
                  search={{ projectType: content.projectType }}
                  className="landing-button landing-button-primary"
                >
                  Screen a Project <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              <aside className="sector-decision-card" aria-label="Grid decision sequence">
                <span>One Connected Decision</span>
                <strong>{content.decision}</strong>
                <ol>
                  <li>
                    <MapPin aria-hidden="true" />
                    <span>
                      <b>Find</b> Candidate nodes
                    </span>
                  </li>
                  <li>
                    <Network aria-hidden="true" />
                    <span>
                      <b>Shape</b> Flexible envelope
                    </span>
                  </li>
                  <li>
                    <Zap aria-hidden="true" />
                    <span>
                      <b>Operate</b> Within limits
                    </span>
                  </li>
                </ol>
              </aside>
            </div>
          </section>

          <section className="sector-proof" aria-label="Model coverage">
            <div className="landing-container sector-metrics">
              {content.metrics.map((metric) => (
                <div key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section sector-questions" aria-labelledby="questions-title">
            <div className="landing-container">
              <div className="landing-section-heading landing-section-heading-split">
                <div>
                  <p className="landing-eyebrow">Decisions Before Application</p>
                  <h2 id="questions-title">Answer the grid questions that change the project.</h2>
                </div>
                <p>
                  Use public evidence and transparent calculations to narrow the search. Preserve
                  the boundary between screening evidence and operator-confirmed capacity.
                </p>
              </div>
              <div className="sector-question-grid">
                {content.questions.map((question, index) => (
                  <article key={question.title}>
                    <span>0{index + 1}</span>
                    <h3>{question.title}</h3>
                    <p>{question.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="landing-section sector-strategy" aria-labelledby="strategy-title">
            <div className="landing-container sector-strategy-grid">
              <div>
                <p className="landing-eyebrow">From Capacity to Control</p>
                <h2 id="strategy-title">
                  Carry one selected grid asset through activation and operations.
                </h2>
              </div>
              <div>
                {content.strategy.map((item) => (
                  <p key={item}>
                    <Check aria-hidden="true" />
                    {item}
                  </p>
                ))}
                <aside>
                  <ShieldCheck aria-hidden="true" />
                  <span>
                    GridPulse screens and models opportunities. The responsible network operator
                    confirms connection capacity, cost and timing.
                  </span>
                </aside>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PublicLayout>
  );
}
