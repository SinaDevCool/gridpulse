import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CircleAlert,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DecisionRow = {
  site_id: string;
  site_name: string;
  project_type: string;
  requested_import_mw: number;
  minimum_viable_import_mw: number | null;
  target_voltage_kv: number | null;
  target_energization_date: string | null;
  operator_name: string | null;
  engagement_status: string;
  evidence_state: string;
  indicated_import_mw: number | null;
  reinforcement_required: boolean | null;
  reinforcement_summary: string | null;
  estimated_connection_cost_eur: number | null;
  indicated_connection_date: string | null;
  response_due_at: string | null;
  offer_expires_at: string | null;
  reservation_expires_at: string | null;
  evidence_score: number;
  evidence_label: string;
  missing_evidence: string[];
  next_deadline: string | null;
};

type DecisionAlert = {
  alert_key: string;
  site_id: string | null;
  severity: "critical" | "warning" | "info";
  alert_type: string;
  title: string;
  detail: string;
  due_at: string | null;
  action_path: string;
};

const label = (value: string) => value.replaceAll("_", " ");
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value))
    : "Not established";
const money = (value: number | null) =>
  value === null
    ? "Not established"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);

export function ConnectionDecisionBoard() {
  const query = useQuery({
    queryKey: ["connection-decision-board"],
    queryFn: async () => {
      const [portfolio, alerts] = await Promise.all([
        supabase.rpc("connection_decision_portfolio"),
        supabase.rpc("connection_decision_alerts"),
      ]);
      if (portfolio.error) throw portfolio.error;
      if (alerts.error) throw alerts.error;
      return {
        rows: (portfolio.data ?? []) as DecisionRow[],
        alerts: (alerts.data ?? []) as DecisionAlert[],
      };
    },
  });

  if (query.isLoading) {
    return <div className="portfolio-state">Loading connection decision intelligence…</div>;
  }
  if (query.error) {
    return (
      <div className="portfolio-state error-message">
        <AlertCircle />
        Decision comparison is temporarily unavailable.
      </div>
    );
  }

  return (
    <>
      <section className="decision-alerts workspace-card" aria-labelledby="decision-alert-title">
        <div className="panel-heading">
          <div>
            <h2 id="decision-alert-title">Action and expiry alerts</h2>
            <p>Operator deadlines and recently changed official sources.</p>
          </div>
          <BellRing />
        </div>
        {query.data?.alerts.length ? (
          <div className="decision-alert-list">
            {query.data.alerts.map((alert) => (
              <article className={`decision-alert ${alert.severity}`} key={alert.alert_key}>
                <CircleAlert />
                <span>
                  <b>{alert.title}</b>
                  <small>
                    {alert.detail}
                    {alert.due_at ? ` · ${date(alert.due_at)}` : ""}
                  </small>
                </span>
                <Link to={alert.action_path as "/portfolio"}>
                  Review <ArrowRight />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="compact-empty">No operator deadline or source-change alerts.</div>
        )}
      </section>

      <section className="decision-board workspace-card" aria-labelledby="decision-board-title">
        <div className="panel-heading">
          <div>
            <h2 id="decision-board-title">Connection candidate comparison</h2>
            <p>
              Evidence completeness supports prioritisation. It is not a probability of connection.
            </p>
          </div>
          <ShieldCheck />
        </div>
        <div className="table-wrap">
          <table className="decision-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Power</th>
                <th>Operator</th>
                <th>Reinforcement</th>
                <th>Cost</th>
                <th>Connection date</th>
                <th>Evidence</th>
                <th>Deadline</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data?.rows.map((row) => (
                <tr key={row.site_id}>
                  <td>
                    <b>{row.site_name}</b>
                    <small>{label(row.project_type)}</small>
                  </td>
                  <td>
                    <b>{row.requested_import_mw} MW requested</b>
                    <small>
                      {row.indicated_import_mw === null
                        ? "No operator indication"
                        : `${row.indicated_import_mw} MW indicated`}
                    </small>
                  </td>
                  <td>
                    <b>{row.operator_name ?? "Unconfirmed"}</b>
                    <small>{label(row.engagement_status)}</small>
                  </td>
                  <td>
                    <b>
                      {row.reinforcement_required === null
                        ? "Not established"
                        : row.reinforcement_required
                          ? "Required"
                          : "Not stated as required"}
                    </b>
                    <small>{row.reinforcement_summary ?? "No written detail"}</small>
                  </td>
                  <td>{money(row.estimated_connection_cost_eur)}</td>
                  <td>{date(row.indicated_connection_date)}</td>
                  <td>
                    <span className="evidence-meter">
                      <i style={{ width: `${row.evidence_score}%` }} />
                    </span>
                    <b>{row.evidence_score}/100</b>
                    <small title={row.missing_evidence.join("\n")}>{row.evidence_label}</small>
                  </td>
                  <td>
                    <CalendarClock />
                    {date(row.next_deadline)}
                  </td>
                  <td>
                    <Link to="/assessments/$id" params={{ id: row.site_id }}>
                      Open <ArrowRight />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.data?.rows.length && (
          <div className="compact-empty">Create a project to begin candidate comparison.</div>
        )}
      </section>
    </>
  );
}
