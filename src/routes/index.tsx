import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Database,
  FileCheck2,
  Gauge,
  MapPinned,
  Network,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { workspaceDestinationsForMode } from "@/components/product/product-navigation";
import { trackEvent } from "@/lib/analytics";
import "../landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse | Data-Centre Site & Power Intelligence" },
      {
        name: "description",
        content:
          "Screen data-centre sites against mapped German grid infrastructure, compare connection candidates and carry evidence into one decision workspace.",
      },
      { property: "og:title", content: "GridPulse Data-Centre Site & Power Intelligence" },
      {
        property: "og:description",
        content:
          "Screen the grid before advancing the site. Compare candidates, inspect evidence and retain the next decision.",
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
    step: "01",
    title: "Define the Site",
    body: "Set the location, requested import, project type and investigation radius.",
  },
  {
    icon: Network,
    step: "02",
    title: "Compare Candidates",
    body: "Review distance, voltage context, operator context and evidence quality together.",
  },
  {
    icon: FileCheck2,
    step: "03",
    title: "Carry the Decision Forward",
    body: "Save the shortlist, assumptions and questions that still require confirmation.",
  },
] as const;

const productCallouts = [
  {
    icon: MapPinned,
    title: "Define a Site Brief",
    body: "Start from a known property or search across a region.",
  },
  {
    icon: SearchCheck,
    title: "Compare Investigation Candidates",
    body: "Rank mapped options without presenting them as available capacity.",
  },
  {
    icon: ShieldCheck,
    title: "Inspect the Evidence",
    body: "Keep public context, calculations and confirmation gaps visible.",
  },
] as const;

const evidenceClasses = [
  {
    icon: Database,
    title: "Public Evidence",
    body: "Mapped infrastructure and published attributes.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Customer Inputs",
    body: "Site requirements and project constraints.",
  },
  {
    icon: Gauge,
    title: "Modelled Scenarios",
    body: "Transparent calculations and declared assumptions.",
  },
  {
    icon: ShieldCheck,
    title: "Operator Confirmation",
    body: "The authority for capacity, works, timing and terms.",
  },
] as const;

const workspaceDescriptions = {
  sites: "Manage opportunities, shortlists and decision status across the portfolio.",
  finder: "Screen mapped grid context and compare candidate connection points.",
  operations:
    "Model facility power, battery and workload responses before live evidence is connected.",
} as const;

const workspaceIcons = {
  sites: BriefcaseBusiness,
  finder: SearchCheck,
  operations: Activity,
} as const;

function DataCentreLandingPage() {
  const workspaces = workspaceDestinationsForMode("finder");
  return (
    <PublicLayout forcePublicChrome finderMarketingChrome>
      <div className="landing-page home-landing">
        <main id="main-content">
          <section className="home-hero" aria-labelledby="hero-title">
            <img
              className="home-hero-image"
              src="/landing/german-grid-hero.webp"
              width="1942"
              height="809"
              alt=""
              fetchPriority="high"
              decoding="async"
            />
            <div className="home-hero-overlay" />
            <div className="landing-container home-hero-content">
              <p className="landing-eyebrow">Data-Centre Site &amp; Power Intelligence</p>
              <h1 id="hero-title">Screen the Grid Before Advancing the Site.</h1>
              <p className="home-hero-lead">
                Compare data-centre opportunities against mapped grid infrastructure, nearby
                connection candidates and traceable public evidence—then carry the shortlist into
                one decision workspace.
              </p>
              <div className="landing-actions">
                <Link
                  to="/power-finder"
                  className="landing-button landing-button-primary"
                  onClick={() =>
                    trackEvent("public_open_power_finder_clicked", { placement: "hero" })
                  }
                >
                  Open Power Finder <ArrowRight aria-hidden="true" />
                </Link>
                <Link
                  to="/portfolio"
                  className="home-secondary-link"
                  onClick={() =>
                    trackEvent("public_open_site_pipeline_clicked", { placement: "hero" })
                  }
                >
                  View Site Pipeline
                </Link>
              </div>
              <p className="home-access-note">
                Explore without an account <span aria-hidden="true">·</span> Screening evidence, not
                a capacity offer
              </p>
            </div>
          </section>

          <section className="home-product" id="product" aria-labelledby="product-title">
            <div className="landing-container">
              <div className="home-section-heading home-section-heading-split">
                <div>
                  <p className="landing-eyebrow">Power Finder</p>
                  <h2 id="product-title">Put the Site in Its Grid Context.</h2>
                </div>
                <p>
                  Move from a location and requested import to a ranked investigation shortlist.
                  Every result preserves its evidence boundary and open confirmation needs.
                </p>
              </div>
              <figure className="home-product-frame">
                <div className="home-product-frame-bar" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <strong>Power Finder · Connection screening</strong>
                </div>
                <picture>
                  <source
                    media="(max-width: 640px)"
                    srcSet="/landing/power-finder-product-mobile.jpg"
                    type="image/jpeg"
                  />
                  <img
                    src="/landing/power-finder-product.jpg"
                    width="1600"
                    height="980"
                    loading="lazy"
                    decoding="async"
                    alt="GridPulse Power Finder in dark mode showing a data-centre site brief, mapped grid context and connection screening map."
                  />
                </picture>
                <figcaption>
                  Public mapped context and investigation candidates remain distinct from
                  operator-confirmed capacity.
                </figcaption>
              </figure>
              <div className="home-product-callouts">
                {productCallouts.map(({ icon: Icon, title, body }) => (
                  <article key={title}>
                    <Icon aria-hidden="true" />
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <Link
                to="/power-finder"
                className="home-inline-link"
                onClick={() =>
                  trackEvent("public_open_power_finder_clicked", { placement: "product_proof" })
                }
              >
                Explore Power Finder <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="home-workspaces" aria-labelledby="workspaces-title">
            <div className="landing-container">
              <div className="home-section-heading">
                <p className="landing-eyebrow">One Workspace, 3 Jobs</p>
                <h2 id="workspaces-title">Carry the Same Decision From Site to Operation.</h2>
              </div>
              <div className="home-workspace-grid">
                {workspaces.map((workspace) => {
                  const id = workspace.id as keyof typeof workspaceIcons;
                  const Icon = workspaceIcons[id];
                  return (
                    <Link
                      key={workspace.id}
                      to={workspace.to}
                      className="home-workspace-card"
                      onClick={() =>
                        trackEvent("public_workspace_clicked", {
                          placement: "workspace_overview",
                          workspace: workspace.id,
                        })
                      }
                    >
                      <span className="home-workspace-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{workspace.label}</strong>
                        <small>{workspace.detail}</small>
                      </span>
                      <p>{workspaceDescriptions[id]}</p>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="home-workflow" id="how-it-works" aria-labelledby="workflow-title">
            <div className="landing-container">
              <div className="home-section-heading">
                <p className="landing-eyebrow">How It Works</p>
                <h2 id="workflow-title">Turn an Opportunity Into an Evidence-Led Next Step.</h2>
              </div>
              <ol className="home-workflow-grid">
                {workflow.map(({ icon: Icon, step, title, body }) => (
                  <li key={title}>
                    <div className="home-workflow-top">
                      <Icon aria-hidden="true" />
                      <span>{step}</span>
                    </div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="home-evidence" id="evidence" aria-labelledby="evidence-title">
            <div className="landing-container">
              <div className="home-section-heading home-section-heading-split">
                <div>
                  <p className="landing-eyebrow">Evidence Before Certainty</p>
                  <h2 id="evidence-title">Know What Supports Every Decision.</h2>
                </div>
                <p>
                  GridPulse keeps public evidence, customer inputs, modelled scenarios and operator
                  confirmation visibly separate.
                </p>
              </div>
              <div className="home-evidence-grid">
                {evidenceClasses.map(({ icon: Icon, title, body }) => (
                  <article key={title}>
                    <Icon aria-hidden="true" />
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
              <aside className="home-boundary">
                <ShieldCheck aria-hidden="true" />
                <p>
                  <strong>Screening evidence—not a capacity offer.</strong> Capacity, connection
                  points, restrictions, works, timing and final terms require confirmation from the
                  responsible network operator.
                </p>
              </aside>
            </div>
          </section>

          <section className="home-final" aria-labelledby="final-title">
            <div className="landing-container home-final-inner">
              <p className="landing-eyebrow">Start With a Real Site</p>
              <h2 id="final-title">See Which Grid Questions Control the Next Decision.</h2>
              <p>
                Define the site brief, compare mapped candidates and retain the evidence needed for
                deeper diligence.
              </p>
              <div className="landing-actions">
                <Link
                  to="/power-finder"
                  className="landing-button landing-button-primary"
                  onClick={() =>
                    trackEvent("public_open_power_finder_clicked", { placement: "final_cta" })
                  }
                >
                  Open Power Finder <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/portfolio" className="home-secondary-link">
                  View Site Pipeline
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PublicLayout>
  );
}
