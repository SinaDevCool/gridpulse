import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ShieldAlert } from "lucide-react";
import {
  buildPortfolioIntelligence,
  type DecisionPortfolioRow,
  type PortfolioRiskFilter,
  type PortfolioSort,
} from "./portfolio-intelligence";

type Props = {
  rows: DecisionPortfolioRow[];
  operator: string;
  risk: PortfolioRiskFilter;
  sort: PortfolioSort;
  onChange: (value: {
    operator?: string;
    risk?: PortfolioRiskFilter;
    sort?: PortfolioSort;
  }) => void;
};

const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function PortfolioIntelligencePanel({ rows, operator, risk, sort, onChange }: Props) {
  const intelligence = buildPortfolioIntelligence(rows, { operator, risk, sort });
  const operators = intelligence.operators.map((item) => item.operator);
  return (
    <section className="workspace-card portfolio-intelligence-panel">
      <div className="panel-heading">
        <div>
          <p className="context-label">Phase 6 · portfolio intelligence</p>
          <h2>Connection Portfolio Control Tower</h2>
          <p>
            Prioritise evidence exposure, deadlines, operator concentration, and MW requiring a
            decision.
          </p>
        </div>
        <BarChart3 aria-hidden="true" />
      </div>
      <div className="portfolio-intelligence-metrics">
        <article>
          <span>Requested demand</span>
          <strong>{number.format(intelligence.metrics.totalMw)} MW</strong>
        </article>
        <article>
          <span>MW blocked by evidence</span>
          <strong>{number.format(intelligence.metrics.atRiskMw)} MW</strong>
        </article>
        <article>
          <span>Operator-indicated</span>
          <strong>{number.format(intelligence.metrics.indicatedMw)} MW</strong>
        </article>
        <article>
          <span>MW without indication</span>
          <strong>{number.format(intelligence.metrics.evidenceGapMw)} MW</strong>
        </article>
        <article>
          <span>Urgent projects</span>
          <strong>{intelligence.metrics.urgentProjects}</strong>
        </article>
        <article>
          <span>Operator-confirmed</span>
          <strong>{intelligence.metrics.confirmedProjects}</strong>
        </article>
      </div>
      <div className="portfolio-concentration">
        <h3>Operator Concentration</h3>
        <div>
          {intelligence.operators.map((item) => (
            <article key={item.operator}>
              <span>{item.operator}</span>
              <b>{number.format(item.requestedMw)} MW</b>
              <small>{item.projects} projects</small>
            </article>
          ))}
        </div>
      </div>
      <div className="portfolio-intelligence-filters">
        <label>
          Operator
          <select
            name="portfolio-operator"
            value={operator}
            onChange={(event) => onChange({ operator: event.target.value })}
          >
            <option value="all">All operators</option>
            {operators.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exposure
          <select
            name="portfolio-risk"
            value={risk}
            onChange={(event) => onChange({ risk: event.target.value as PortfolioRiskFilter })}
          >
            <option value="all">All projects</option>
            <option value="blocked">Blocked by evidence</option>
            <option value="deadline">Deadline within 30 days</option>
            <option value="operator_confirmed">Operator confirmed</option>
          </select>
        </label>
        <label>
          Sort
          <select
            name="portfolio-sort"
            value={sort}
            onChange={(event) => onChange({ sort: event.target.value as PortfolioSort })}
          >
            <option value="urgency">Decision urgency</option>
            <option value="evidence">Evidence strength</option>
            <option value="mw">Requested MW</option>
            <option value="name">Project name</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="decision-table portfolio-control-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Operator</th>
              <th>Requested / indicated</th>
              <th>Evidence</th>
              <th>Engagement</th>
              <th>Next deadline</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {intelligence.rows.map((row) => (
              <tr data-severity={row.risk.severity} key={row.site_id}>
                <td>
                  <b>{row.site_name}</b>
                  <small>{row.project_type.replaceAll("_", " ")}</small>
                </td>
                <td>{row.operator_name ?? "Unconfirmed"}</td>
                <td>
                  {number.format(row.requested_import_mw)} /{" "}
                  {row.indicated_import_mw == null
                    ? "unknown"
                    : number.format(row.indicated_import_mw)}{" "}
                  MW
                </td>
                <td>
                  <b>{row.evidence_score}/100</b>
                  <small>{row.missing_evidence.length} open gaps</small>
                </td>
                <td>{row.engagement_status.replaceAll("_", " ")}</td>
                <td>
                  {row.next_deadline ? date.format(new Date(row.next_deadline)) : "No deadline"}
                </td>
                <td>
                  <Link
                    to="/assessments/$id"
                    params={{ id: row.site_id }}
                    search={{ view: "operator" }}
                  >
                    Review <ArrowRight aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!intelligence.rows.length ? (
        <div className="compact-empty">No projects match these portfolio controls.</div>
      ) : null}
      <footer className="portfolio-intelligence-boundary">
        <ShieldAlert aria-hidden="true" />
        {intelligence.boundary}
      </footer>
    </section>
  );
}
