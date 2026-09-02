import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, MapPinned, Network } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import "../landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse | Data-Centre Site Intelligence" },
      {
        name: "description",
        content:
          "Qualify data-centre property opportunities with evidence-led site context and German grid screening.",
      },
      { property: "og:title", content: "GridPulse Data-Centre Site Intelligence" },
      {
        property: "og:description",
        content: "Move from property opportunity to a clear, evidence-led site decision.",
      },
      { property: "og:url", content: "https://gridpulseinsights.com/" },
      { name: "theme-color", content: "#05080f" },
    ],
    links: [
      { rel: "canonical", href: "https://gridpulseinsights.com/" },
      { rel: "preload", href: "/landing/german-grid-hero.webp", as: "image" },
    ],
  }),
  component: DataCentreLandingPage,
});

const workflow = [
  {
    icon: MapPinned,
    title: "Bring the opportunity",
    body: "Start with a single location or an existing property portfolio.",
  },
  {
    icon: Network,
    title: "Investigate the grid",
    body: "Compare mapped connection hypotheses and their evidence context.",
  },
  {
    icon: FileCheck2,
    title: "Record the decision",
    body: "Keep confirmed facts, screened context, and open questions distinct.",
  },
] as const;

function DataCentreLandingPage() {
  return (
    <PublicLayout forcePublicChrome finderMarketingChrome>
      <div className="landing-page minimal-landing">
        <main id="main-content">
          <section className="minimal-hero" aria-labelledby="hero-title">
            <img
              className="minimal-hero-image"
              src="/landing/german-grid-hero.webp"
              width="1942"
              height="809"
              alt=""
              fetchPriority="high"
              decoding="async"
            />
            <div className="minimal-hero-overlay" />
            <div className="landing-container minimal-hero-content">
              <p className="landing-eyebrow">Data-Centre Site Intelligence</p>
              <h1 id="hero-title">See which sites are worth advancing.</h1>
              <p className="minimal-hero-lead">
                Qualify property opportunities with mapped grid context, traceable evidence, and a
                clear next decision.
              </p>
              <div className="landing-actions">
                <Link to="/portfolio" className="landing-button landing-button-primary">
                  Open Site Pipeline <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/power-finder" className="minimal-secondary-link">
                  Explore Power Finder
                </Link>
              </div>
              <p className="minimal-access-note">Anonymous workspace · No account required</p>
            </div>
          </section>

          <section className="minimal-flow" id="how-it-works" aria-labelledby="flow-title">
            <div className="landing-container">
              <div className="minimal-section-heading">
                <p className="landing-eyebrow">One focused workflow</p>
                <h2 id="flow-title">From land opportunity to an informed next step.</h2>
              </div>
              <div className="minimal-flow-grid">
                {workflow.map(({ icon: Icon, title, body }) => (
                  <article key={title}>
                    <Icon aria-hidden="true" />
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="minimal-positioning" aria-labelledby="positioning-title">
            <div className="landing-container minimal-positioning-inner">
              <p className="landing-eyebrow">Evidence before certainty</p>
              <h2 id="positioning-title">
                A practical bridge between real estate and grid diligence.
              </h2>
              <p>
                GridPulse helps teams decide where deeper investigation is justified. Public mapping
                supports screening; connection capacity and terms remain subject to network-operator
                confirmation.
              </p>
              <Link to="/portfolio" className="landing-button landing-button-primary">
                Start Screening <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        </main>
      </div>
    </PublicLayout>
  );
}
