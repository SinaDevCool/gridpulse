import { ArrowRight, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AnonymousSiteSummary } from "@/features/anonymous-workspace/portfolio-projection";
import type { buildPortfolioIntelligence } from "@/features/grid-connection/portfolio-intelligence";
type PortfolioIntelligence = ReturnType<typeof buildPortfolioIntelligence>;

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const matrixKeys = ["land", "planning", "grid", "fibre", "environment", "municipality"] as const;

export function PortfolioReadinessView({ sites }: { sites: AnonymousSiteSummary[] }) {
  if (!sites.length) return <PortfolioEmpty message="No sites match this readiness scope." />;
  return (
    <section className="portfolio-matrix-section">
      <header>
        <div>
          <p className="context-label">Development Readiness</p>
          <h2>Portfolio Readiness</h2>
          <p>Compare confirmed site findings and unresolved screening checks.</p>
        </div>
      </header>
      <div className="portfolio-matrix">
        <div className="matrix-head">
          <b>Site</b>
          {matrixKeys.map((key) => (
            <b key={key}>{key}</b>
          ))}
        </div>
        {sites.map((site) => (
          <Link
            key={site.id}
            to="/portfolio/$id"
            params={{ id: site.id }}
            search={{ tab: "qualification" }}
          >
            <strong>
              {site.name}
              <small>{site.qualificationReadiness}% confirmed</small>
            </strong>
            {matrixKeys.map((key) => {
              const status =
                site.property.qualification?.find((item) => item.key === key)?.status ?? "unknown";
              return (
                <span
                  key={key}
                  className={`matrix-status status-${status}`}
                  title={`${key}: ${status}`}
                >
                  {status}
                </span>
              );
            })}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PortfolioDecisionView({
  intelligence,
  sites,
}: {
  intelligence: PortfolioIntelligence;
  sites: AnonymousSiteSummary[];
}) {
  const indexed = new Map(sites.map((site) => [site.id, site]));
  return (
    <>
      <section className="decision-kpi-strip is-mvp" aria-label="Portfolio decision metrics">
        <Kpi label="Declared Demand" value={`${number.format(intelligence.metrics.totalMw)} MW`} />
        <Kpi
          label="Sites Requiring Action"
          value={intelligence.metrics.urgentProjects}
          tone="warning"
        />
        <Kpi
          label="Decision Ready"
          value={sites.filter((site) => site.stage === "decision_ready").length}
          tone="positive"
        />
      </section>
      <section className="decision-priority-section">
        <header>
          <div>
            <p className="context-label">Decision Work Queue</p>
            <h2>Decision Review</h2>
          </div>
          <span>{intelligence.rows.length} shown</span>
        </header>
        {intelligence.rows.length ? (
          <div className="decision-priority-list">
            {intelligence.rows.map((row) => {
              const site = indexed.get(row.site_id);
              if (!site) return null;
              return (
                <article key={row.site_id} data-severity={row.risk.severity}>
                  <div>
                    <span className={`decision-chip is-${site.decisionStatus}`}>
                      {site.decisionStatus}
                    </span>
                    <h3>{site.name}</h3>
                    <p>
                      {site.locationLabel} · {site.projectType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <dl>
                    <div>
                      <dt>Required</dt>
                      <dd>{number.format(site.requiredMw)} MW</dd>
                    </div>
                    <div>
                      <dt>Grid Hypothesis</dt>
                      <dd>{site.preferredCandidate?.nodeName ?? "Not screened"}</dd>
                    </div>
                    <div>
                      <dt>Operator</dt>
                      <dd>{site.operator ?? "Unconfirmed"}</dd>
                    </div>
                    <div>
                      <dt>Confirmed Readiness</dt>
                      <dd>{site.qualificationReadiness}%</dd>
                    </div>
                  </dl>
                  <p className="priority-blocker">
                    <b>Check Before Decision</b>
                    {row.missing_evidence[0] ?? "No material check recorded"}
                  </p>
                  <p className="priority-next">
                    <b>Next</b>
                    {site.nextAction}
                  </p>
                  <Link to="/portfolio/$id" params={{ id: site.id }} search={{ tab: "decision" }}>
                    Review Decision <ArrowRight aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <PortfolioEmpty message="No sites match this decision scope." />
        )}
      </section>
    </>
  );
}

function PortfolioEmpty({ message }: { message: string }) {
  return (
    <div className="decision-empty compact">
      <FileText aria-hidden="true" />
      <h3>No Matching Sites</h3>
      <p>{message}</p>
    </div>
  );
}
function Kpi({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <article className={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
