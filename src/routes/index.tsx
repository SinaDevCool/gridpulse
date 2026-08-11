import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Check,
  CircleDot,
  Database,
  FileCheck2,
  LandPlot,
  MapPinned,
  Network,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import "../landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse | Data-Centre Site Intelligence" },
      {
        name: "description",
        content:
          "Turn property portfolios into evidence-led data-centre site decisions with German grid screening, site readiness and decision-ready records.",
      },
      { property: "og:title", content: "GridPulse Data-Centre Site Intelligence" },
      {
        property: "og:description",
        content:
          "Qualify Greenfield and Brownfield opportunities, investigate grid hypotheses and prepare defensible site decisions.",
      },
      { property: "og:url", content: "https://gridpulseinsights.com/" },
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
    number: "01",
    icon: Upload,
    title: "Bring in the portfolio",
    body: "Import property records or start with one location. Keep the site brief, declared load and source data together.",
    output: "A structured site pipeline",
  },
  {
    number: "02",
    icon: Network,
    title: "Screen the grid context",
    body: "Investigate mapped connection candidates by location, voltage, likely operator and evidence quality.",
    output: "Ranked connection hypotheses",
  },
  {
    number: "03",
    icon: FileCheck2,
    title: "Make the decision legible",
    body: "Separate screened context from confirmed evidence and record the next action for every opportunity.",
    output: "A decision-ready site record",
  },
] as const;

const clientNeeds = [
  {
    icon: LandPlot,
    title: "Owners & asset managers",
    body: "See which Greenfield and Brownfield assets deserve deeper data-centre diligence before committing advisory time.",
  },
  {
    icon: Building2,
    title: "Developers & operators",
    body: "Compare candidate locations against the declared power requirement and prepare focused operator questions.",
  },
  {
    icon: ShieldCheck,
    title: "Investment teams",
    body: "Review the evidence position, material unknowns and decision rationale across an entire opportunity pipeline.",
  },
] as const;

function DataCentreLandingPage() {
  return (
    <PublicLayout forcePublicChrome finderMarketingChrome>
      <div className="landing-page dc-landing">
        <main id="main-content">
          <section className="dc-hero" aria-labelledby="hero-title">
            <img
              className="dc-hero-image"
              src="/landing/german-grid-hero.webp"
              width="1942"
              height="809"
              alt="Electrical substation beside industrial infrastructure at blue hour"
              fetchPriority="high"
              decoding="async"
            />
            <div className="dc-hero-wash" />
            <div className="landing-container dc-hero-grid">
              <div className="dc-hero-copy">
                <p className="landing-eyebrow">Data-Centre Real Estate Intelligence</p>
                <h1 id="hero-title">Know which sites deserve the next conversation.</h1>
                <p className="dc-hero-lead">
                  Turn Greenfield, Brownfield and transformation opportunities into a qualified
                  pipeline—combining property context, grid hypotheses, public evidence and clear
                  next actions.
                </p>
                <div className="landing-actions">
                  <Link to="/portfolio" className="landing-button landing-button-primary">
                    Open the Site Pipeline <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link to="/demo" className="landing-button landing-button-secondary">
                    See the Workflow
                  </Link>
                </div>
                <ul className="dc-hero-proof" aria-label="Product access and scope">
                  <li>
                    <Check aria-hidden="true" /> No account required
                  </li>
                  <li>
                    <Check aria-hidden="true" /> Germany-wide screening context
                  </li>
                  <li>
                    <Check aria-hidden="true" /> Evidence boundaries built in
                  </li>
                </ul>
              </div>

              <div className="dc-hero-product" aria-label="Illustrative site qualification view">
                <header>
                  <span>
                    <CircleDot aria-hidden="true" /> Site Pipeline
                  </span>
                  <small>12 Opportunities</small>
                </header>
                <div className="dc-product-summary">
                  <div>
                    <small>Portfolio</small>
                    <strong>1,211 MW</strong>
                  </div>
                  <div>
                    <small>Action Required</small>
                    <strong>8 sites</strong>
                  </div>
                  <div>
                    <small>Screened</small>
                    <strong>4 sites</strong>
                  </div>
                </div>
                <div className="dc-product-site is-active">
                  <div>
                    <small>Brownfield · 80 MW</small>
                    <strong>Nuremberg Digital Campus</strong>
                    <span>Grid hypothesis available</span>
                  </div>
                  <div className="dc-product-score">
                    <small>Evidence</small>
                    <strong>62%</strong>
                  </div>
                </div>
                <div className="dc-product-site">
                  <div>
                    <small>Port-industrial · 125 MW</small>
                    <strong>North Sea Compute Site</strong>
                    <span>Operator context to review</span>
                  </div>
                  <div className="dc-product-score">
                    <small>Evidence</small>
                    <strong>41%</strong>
                  </div>
                </div>
                <div className="dc-product-action">
                  <MapPinned aria-hidden="true" />
                  <span>
                    <small>Next Best Action</small>
                    <strong>Review the recommended grid candidate</strong>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </div>
                <p>Illustrative interface · Capacity requires operator confirmation</p>
              </div>
            </div>
          </section>

          <section className="dc-problem" aria-labelledby="problem-title">
            <div className="landing-container dc-problem-grid">
              <div>
                <p className="landing-eyebrow">The qualification gap</p>
                <h2 id="problem-title">A promising plot is not yet a data-centre opportunity.</h2>
              </div>
              <div className="dc-problem-list">
                <p>
                  <span>01</span> Property data arrives in spreadsheets, reports and local
                  knowledge.
                </p>
                <p>
                  <span>02</span> Grid context is difficult to compare consistently across sites.
                </p>
                <p>
                  <span>03</span> Public findings, assumptions and confirmed evidence become mixed.
                </p>
                <p>
                  <span>04</span> Investment teams need a clear decision before full technical
                  diligence.
                </p>
              </div>
            </div>
          </section>

          <section
            className="landing-section dc-workflow"
            id="how-it-works"
            aria-labelledby="workflow-title"
          >
            <div className="landing-container">
              <div className="landing-section-heading landing-section-heading-split">
                <div>
                  <p className="landing-eyebrow">One continuous workflow</p>
                  <h2 id="workflow-title">From property portfolio to decision package.</h2>
                </div>
                <p>
                  GridPulse adds a repeatable digital qualification layer to real-estate expertise.
                  It helps teams prioritise diligence without pretending public mapping is a
                  connection offer.
                </p>
              </div>
              <ol className="dc-workflow-grid">
                {workflow.map(({ number, icon: Icon, title, body, output }) => (
                  <li key={number}>
                    <div className="dc-step-top">
                      <span>{number}</span>
                      <Icon aria-hidden="true" />
                    </div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                    <div className="dc-step-output">
                      <Check aria-hidden="true" />
                      <span>{output}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="landing-section dc-usp" aria-labelledby="usp-title">
            <div className="landing-container dc-usp-grid">
              <div className="dc-usp-copy">
                <p className="landing-eyebrow">The GridPulse difference</p>
                <h2 id="usp-title">The missing bridge between land advisory and grid diligence.</h2>
                <p>
                  The product does not replace property expertise or network-operator studies. It
                  makes the handoff between them faster, traceable and easier to defend.
                </p>
                <ul>
                  <li>
                    <Database aria-hidden="true" />
                    <span>
                      <strong>Portfolio-native</strong>Import and compare opportunities rather than
                      screening isolated points.
                    </span>
                  </li>
                  <li>
                    <Search aria-hidden="true" />
                    <span>
                      <strong>Evidence-aware</strong>See what is mapped, what is client-declared and
                      what still needs confirmation.
                    </span>
                  </li>
                  <li>
                    <FileCheck2 aria-hidden="true" />
                    <span>
                      <strong>Decision-led</strong>Turn screening output into a site record with
                      rationale, open checks and next action.
                    </span>
                  </li>
                </ul>
                <Link to="/power-finder" className="landing-text-link">
                  Explore Power Finder <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              <div className="dc-decision-stack" aria-label="GridPulse evidence model">
                <article>
                  <span>01</span>
                  <div>
                    <small>Imported Client Context</small>
                    <strong>Site, area, load, timing & land position</strong>
                  </div>
                  <Check aria-hidden="true" />
                </article>
                <article>
                  <span>02</span>
                  <div>
                    <small>Public Screening</small>
                    <strong>Location, grid, operator & environmental context</strong>
                  </div>
                  <Check aria-hidden="true" />
                </article>
                <article>
                  <span>03</span>
                  <div>
                    <small>Human Confirmation</small>
                    <strong>Accept, edit or reject every material finding</strong>
                  </div>
                  <Check aria-hidden="true" />
                </article>
                <article className="is-result">
                  <span>04</span>
                  <div>
                    <small>Decision Output</small>
                    <strong>A concise, exportable site decision package</strong>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </article>
              </div>
            </div>
          </section>

          <section className="landing-section dc-clients" aria-labelledby="clients-title">
            <div className="landing-container">
              <div className="landing-section-heading landing-section-heading-centered">
                <p className="landing-eyebrow">Built around the deal team</p>
                <h2 id="clients-title">One evidence position for every stakeholder.</h2>
                <p>
                  Keep commercial opportunity, technical uncertainty and the next decision visible
                  without forcing every stakeholder into a grid-engineering tool.
                </p>
              </div>
              <div className="dc-client-grid">
                {clientNeeds.map(({ icon: Icon, title, body }) => (
                  <article key={title}>
                    <Icon aria-hidden="true" />
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="dc-final" aria-labelledby="final-title">
            <div className="landing-container dc-final-inner">
              <p className="landing-eyebrow">Start with a real opportunity</p>
              <h2 id="final-title">
                Find the sites worth advancing—and the questions that stand in the way.
              </h2>
              <p>Import a portfolio or screen a single German property. No sign-in required.</p>
              <div className="landing-actions">
                <Link to="/portfolio" className="landing-button landing-button-primary">
                  Open the Site Pipeline <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/data-sources" className="landing-text-link">
                  Review Methodology & Sources <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PublicLayout>
  );
}
