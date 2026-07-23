import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BarChart3, BellRing, FileText } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { readiness, type CandidateSite, type Evidence } from "@/lib/assessment-model";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Management Reports | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReportsPage,
});

type Summary = {
  project_count: number;
  requested_import_mw: number;
  indicated_import_mw: number;
  estimated_capital_eur: number;
  blocked_by_evidence: number;
  awaiting_operator: number;
  offers_requiring_decision: number;
  operator_confirmed: number;
};
type Benchmark = {
  operator_name: string;
  completed_pilots: number;
  response_time_days: number | null;
  clarification_rounds: number | null;
  reinforcement_rate: number | null;
  indicated_lead_time_days: number | null;
  cost_per_requested_mw_eur: number | null;
  customer_confirmed_observations: number;
};
type Notification = {
  id: string;
  severity: string;
  title: string;
  detail: string;
  action_path: string | null;
};
type Onboarding = {
  id: string;
  priority: number;
  operator_name: string;
  source_discovery_status: string;
  geographic_value: string;
  rights_status: string;
  next_action: string;
};

const number = (value: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
const money = (value: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);

function ReportsPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["management-reports", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const refreshed = await supabase.rpc("refresh_my_notifications");
      if (refreshed.error) throw refreshed.error;
      const [sites, evidence, summary, benchmarks, notifications, onboarding] = await Promise.all([
        supabase
          .from("candidate_sites")
          .select("*")
          .neq("assessment_status", "archived")
          .order("created_at", { ascending: false }),
        supabase.from("assessment_evidence").select("*"),
        supabase.rpc("management_portfolio_summary"),
        supabase.rpc("operator_pilot_benchmarks"),
        supabase
          .from("user_notifications")
          .select("id,severity,title,detail,action_path")
          .is("read_at", null)
          .is("dismissed_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("operator_onboarding_register")
          .select("*")
          .order("priority")
          .order("operator_name"),
      ]);
      for (const result of [sites, evidence, summary, benchmarks, notifications, onboarding])
        if (result.error) throw result.error;
      return {
        projects: (sites.data as CandidateSite[]).map((site) => ({
          site,
          state: readiness(
            (evidence.data as Evidence[]).filter((item) => item.site_id === site.id),
          ),
        })),
        summary: summary.data as Summary,
        benchmarks: (benchmarks.data ?? []) as Benchmark[],
        notifications: (notifications.data ?? []) as Notification[],
        onboarding: (onboarding.data ?? []) as Onboarding[],
      };
    },
  });
  const data = query.data;
  const metrics: Array<[string, number, string]> = data
    ? [
        ["Active projects", data.summary.project_count, ""],
        ["Demand under assessment", data.summary.requested_import_mw, " MW"],
        ["Operator-indicated power", data.summary.indicated_import_mw, " MW"],
        ["Blocked by evidence", data.summary.blocked_by_evidence, ""],
        ["Awaiting operator", data.summary.awaiting_operator, ""],
        ["Offers requiring decision", data.summary.offers_requiring_decision, ""],
        ["Operator confirmed", data.summary.operator_confirmed, ""],
      ]
    : [];

  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page management-report">
        <PageHeading
          eyebrow="Decision intelligence"
          title="Management portfolio and pilot learning"
          description="Track decision exposure, operator progress and consent-controlled evidence of GridPulse customer value."
        />
        {query.isLoading ? (
          <div className="portfolio-state">
            <div className="loading-spinner" />
            Loading management intelligence…
          </div>
        ) : null}
        {query.error ? (
          <div className="portfolio-state error-message">
            <AlertTriangle />
            {query.error instanceof Error ? query.error.message : "Reporting unavailable."}
          </div>
        ) : null}
        {data ? (
          <>
            <section className="management-kpi-grid">
              {metrics.map(([label, value, suffix]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>
                    {number(value)}
                    {suffix}
                  </strong>
                </article>
              ))}
              <article>
                <span>Indicative connection capital</span>
                <strong>{money(data.summary.estimated_capital_eur)}</strong>
              </article>
            </section>
            <section className="workspace-card">
              <div className="panel-heading">
                <div>
                  <h2>Action inbox</h2>
                  <p>
                    In-app alerts are live. Warning and critical items are also queued in the email
                    delivery ledger.
                  </p>
                </div>
                <BellRing />
              </div>
              {data.notifications.length ? (
                <div className="decision-alert-list">
                  {data.notifications.map((item) => (
                    <article className={`decision-alert ${item.severity}`} key={item.id}>
                      <BellRing />
                      <span>
                        <b>{item.title}</b>
                        <small>{item.detail}</small>
                      </span>
                      {item.action_path ? (
                        <Link to={item.action_path as "/portfolio"}>
                          Review <ArrowRight />
                        </Link>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="compact-empty">No unread alerts.</div>
              )}
            </section>
            <section className="workspace-card">
              <div className="panel-heading">
                <div>
                  <h2>Consented pilot benchmarks</h2>
                  <p>
                    Only completed pilots with anonymised-case permission and a customer-confirmed
                    final observation are included.
                  </p>
                </div>
                <BarChart3 />
              </div>
              <div className="table-wrap">
                <table className="decision-table">
                  <thead>
                    <tr>
                      <th>Operator</th>
                      <th>Pilots</th>
                      <th>Response</th>
                      <th>Clarifications</th>
                      <th>Reinforcement</th>
                      <th>Lead time</th>
                      <th>Cost / requested MW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.benchmarks.map((row) => (
                      <tr key={row.operator_name}>
                        <td>
                          <b>{row.operator_name}</b>
                          <small>
                            {row.customer_confirmed_observations} confirmed observations
                          </small>
                        </td>
                        <td>{row.completed_pilots}</td>
                        <td>{row.response_time_days ?? "—"} days</td>
                        <td>{row.clarification_rounds ?? "—"}</td>
                        <td>
                          {row.reinforcement_rate == null ? "—" : `${row.reinforcement_rate}%`}
                        </td>
                        <td>{row.indicated_lead_time_days ?? "—"} days</td>
                        <td>{money(row.cost_per_requested_mw_eur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.benchmarks.length ? (
                <div className="compact-empty">
                  No consented, customer-confirmed final pilot outcomes yet. This is intentionally
                  not estimated.
                </div>
              ) : null}
            </section>
            <section className="workspace-card">
              <div className="panel-heading">
                <div>
                  <h2>Operator data onboarding</h2>
                  <p>
                    Prioritised source discovery and reuse-rights work. Capacity remains “not
                    established” until written evidence exists.
                  </p>
                </div>
                <FileText />
              </div>
              <div className="onboarding-grid">
                {data.onboarding.map((row) => (
                  <article key={row.id}>
                    <span>
                      Priority {row.priority} · {row.source_discovery_status.replaceAll("_", " ")}
                    </span>
                    <h3>{row.operator_name}</h3>
                    <p>{row.geographic_value}</p>
                    <small>Rights: {row.rights_status.replaceAll("_", " ")}</small>
                    <b>{row.next_action}</b>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2>Project deliverables</h2>
              <div className="report-index-grid">
                {data.projects.map(({ site, state }) => (
                  <article className="report-index-card" key={site.id}>
                    <p className="context-label">{site.id.slice(0, 8)}</p>
                    <h2>{site.name}</h2>
                    <p>{state.completed}/3 readiness requirements complete</p>
                    <span className={state.ready ? "status collected" : "status warning-text"}>
                      {state.ready ? "Ready" : "Evidence incomplete"}
                    </span>
                    <Link to="/assessments/$id" params={{ id: site.id }}>
                      Open assessment <ArrowRight />
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
