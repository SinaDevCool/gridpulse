import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Database, MapPinned, Network, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import "../landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse Power Finder | German Grid Screening" },
      {
        name: "description",
        content:
          "Screen German grid nodes, industrial sites, voltage context and source evidence with GridPulse Power Finder. No account required.",
      },
      { property: "og:title", content: "GridPulse Power Finder" },
      {
        property: "og:description",
        content:
          "Evidence-aware site-to-grid screening for German infrastructure projects. No account required.",
      },
      { property: "og:url", content: "https://gridpulseinsights.com/" },
    ],
    links: [
      { rel: "canonical", href: "https://gridpulseinsights.com/" },
      { rel: "preload", href: "/landing/german-grid-hero.webp", as: "image" },
    ],
  }),
  component: FinderLandingPage,
});

const finderCapabilities = [
  {
    icon: MapPinned,
    title: "Discover viable search areas",
    description:
      "Explore grid infrastructure, industrial land, voltage context and registered assets around a proposed site.",
  },
  {
    icon: Network,
    title: "Shortlist connection candidates",
    description:
      "Compare mapped nodes using proximity, voltage alignment, operator context and evidence quality.",
  },
  {
    icon: Database,
    title: "Know what needs confirmation",
    description:
      "Separate public evidence, illustrative analysis and reviewed private results before engaging an operator.",
  },
] as const;

function FinderLandingPage() {
  return (
    <PublicLayout>
      <div className="landing-page finder-landing-page">
        <main id="main-content">
          <section className="landing-hero" aria-labelledby="hero-title">
            <img
              className="landing-hero-image"
              src="/landing/german-grid-hero.webp"
              width="1942"
              height="809"
              alt="German electrical substation and industrial infrastructure at blue hour"
              fetchPriority="high"
              decoding="async"
            />
            <div className="landing-hero-overlay" />
            <div className="landing-container landing-hero-content">
              <p className="landing-eyebrow">GridPulse Power Finder</p>
              <h1 id="hero-title">Find stronger grid connection candidates, sooner.</h1>
              <p className="landing-hero-lead">
                Turn fragmented public grid evidence into a focused shortlist for large-load and
                energy projects in Germany. Start with the map, compare candidates, then take the
                strongest options into technical review.
              </p>
              <div className="landing-actions">
                <Link to="/power-finder" className="landing-button landing-button-primary">
                  Open Power Finder <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/data-sources" className="landing-button landing-button-secondary">
                  Review the data
                </Link>
              </div>
              <p className="landing-audience">
                For data centres, storage, charging, hydrogen and industrial projects evaluating
                where to investigate a grid connection.
              </p>
            </div>
          </section>

          <section className="landing-section landing-process" aria-labelledby="finder-value">
            <div className="landing-container">
              <div className="landing-section-heading landing-section-heading-centered">
                <p className="landing-eyebrow">From search area to shortlist</p>
                <h2 id="finder-value">Reduce the search space before costly grid studies.</h2>
                <p>
                  GridPulse brings location, network context and source quality into one screening
                  workflow. Where reviewed capacity results exist, they can be compared with the
                  project requirement; everywhere else, capacity remains explicitly unknown.
                </p>
              </div>
              <div className="landing-outcomes-grid">
                {finderCapabilities.map(({ icon: Icon, title, description }) => (
                  <article key={title}>
                    <Icon aria-hidden="true" />
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="landing-section landing-outcomes" aria-labelledby="coverage-title">
            <div className="landing-container">
              <div className="landing-section-heading landing-section-heading-split">
                <div>
                  <p className="landing-eyebrow">Current MVP coverage</p>
                  <h2 id="coverage-title">Start with the accepted Brandenburg release.</h2>
                </div>
                <p>
                  The MVP displays accepted OpenStreetMap topology and registered asset context.
                  National coverage is planned and is not implied by the current release.
                </p>
              </div>
              <aside className="landing-trust-note">
                <ShieldCheck aria-hidden="true" />
                <p>
                  <strong>Screening context—not confirmed capacity.</strong> Grey or unknown
                  capacity means no accepted publication establishes demand headroom. Connection
                  point, feasibility, cost and timing remain controlled by the responsible network
                  operator.
                </p>
              </aside>
              <div className="landing-centered-action">
                <Link to="/power-finder" className="landing-button landing-button-primary">
                  Explore Brandenburg <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PublicLayout>
  );
}
