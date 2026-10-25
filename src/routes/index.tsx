import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { SolutionPreview } from "@/components/public/SolutionPreview";
import { enabledSolutions, solutions } from "@/config/solutions";
import { solutionContent } from "@/config/solution-content";
import { trackEvent } from "@/lib/analytics";
import "../landing.css";

const available = solutions.filter((solution) => enabledSolutions.includes(solution.id));
const title =
  available.length === 2
    ? "GridPulse | Site Selection & Facility Operations"
    : `${available[0].label} | GridPulse`;
const description =
  available.length === 2
    ? "Screen grid-connection options and optimise battery and workload plans within modelled power limits."
    : solutionContent[available[0].id].summary;
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://gridpulseinsights.com/" },
      { name: "theme-color", content: "#05080f" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/" }],
  }),
  component: DataCentreLandingPage,
});

function recordOpen(solution: (typeof solutions)[number], placement: string) {
  trackEvent("public_solution_opened", {
    solution: solution.id,
    placement,
    destination: solution.to,
  });
  if (solution.id === "planning") trackEvent("public_open_power_finder_clicked", { placement });
}

function DataCentreLandingPage() {
  return (
    <PublicLayout forcePublicChrome solutionMarketingChrome>
      <main id="main-content" className="landing-page home-landing">
        <section className="home-hero">
          <div className="public-container home-hero-content">
            <p className="public-eyebrow">Data-centre power intelligence</p>
            <h1>
              {available.length === 2
                ? "Choose the site. Plan the operation."
                : solutionContent[available[0].id].headline}
            </h1>
            <p className="home-hero-lead">{description}</p>
            <div className="home-service-grid">
              {available.map((solution) => (
                <article className="home-service-card" key={solution.id}>
                  <p className="public-eyebrow">{solutionContent[solution.id].badge}</p>
                  <h2>{solution.label}</h2>
                  <p>{solutionContent[solution.id].headline}</p>
                  <p className="home-audience">For {solution.audience.toLowerCase()}.</p>
                  <Link
                    to={solution.to}
                    className="public-button public-button-primary"
                    onClick={() => recordOpen(solution, "hero")}
                  >
                    {solutionContent[solution.id].entry}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link to={solution.introduction} className="home-inline-link">
                    About {solution.label}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="product" className="home-product">
          <div className="public-container">
            <header className="home-section-heading">
              <p className="public-eyebrow">Two decisions. Clear evidence.</p>
              <h2>See what each service helps you decide.</h2>
              <p>Start with the question you have today. Each workspace works independently.</p>
            </header>
            {available.map((solution) => (
              <article className="home-service-proof" key={solution.id}>
                <div className="home-proof-heading">
                  <h3>{solution.label}</h3>
                  <p>{solutionContent[solution.id].summary}</p>
                </div>
                <SolutionPreview id={solution.id} />
                <ol className="home-service-workflow" aria-label={`${solution.label} workflow`}>
                  {solutionContent[solution.id].steps.map(([step, body], index) => (
                    <li key={step}>
                      <span aria-hidden="true">0{index + 1}</span>
                      <h4>{step}</h4>
                      <p>{body}</p>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
        <section id="evidence" className="home-evidence">
          <div className="public-container">
            <p className="public-eyebrow">Evidence & boundaries</p>
            <h2>Know what supports the decision.</h2>
            <div className="home-service-grid">
              {available.map((solution) => (
                <article className="home-service-card" key={solution.id}>
                  <h3>{solution.label}</h3>
                  <p>{solutionContent[solution.id].boundary}</p>
                </article>
              ))}
            </div>
            <Link to="/data-sources" className="home-inline-link">
              Evidence & Methodology
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section className="home-final">
          <div className="public-container">
            <h2>Start with your next power decision.</h2>
            <div className="public-actions">
              {available.map((solution) => (
                <Link
                  key={solution.id}
                  to={solution.to}
                  className="public-button public-button-primary"
                  onClick={() => recordOpen(solution, "final_cta")}
                >
                  {solutionContent[solution.id].entry}
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
