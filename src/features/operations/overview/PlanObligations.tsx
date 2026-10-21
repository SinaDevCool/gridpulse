import { Link, useSearch } from "@tanstack/react-router";
import { formatMwh, formatPercent } from "../formatting";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { selectPlanObligations } from "./select-plan-obligations";

export function PlanObligations({
  fullModel,
  selected,
}: {
  fullModel: OperationsOverviewModel;
  selected: OperationsScenarioKind;
}) {
  const s = selectPlanObligations(fullModel, selected);
  const search = useSearch({ from: "/operations" });
  const total = Math.max(s.deferred ?? 0, (s.recovered ?? 0) + (s.unresolved ?? 0), 0.001);
  return (
    <section
      id="operations-recovery"
      className="ops-obligations"
      aria-labelledby="ops-obligations-title"
      tabIndex={-1}
    >
      <header>
        <div>
          <p className="context-label">Full planning horizon</p>
          <h3 id="ops-obligations-title">Remaining obligations</h3>
        </div>
        <span>Aggregate scenario · not a validated job schedule</span>
      </header>
      {!s.available ? (
        <p>Assessment unavailable. Recovery and reserve checks cannot be established.</p>
      ) : (
        <>
          {s.recoveryRequired ? (
            <div className="ops-recovery-ledger">
              <div className="ops-ledger-heading">
                <strong>Deferred workload energy</strong>
                <span>{formatMwh(s.deferred!)} deferred</span>
              </div>
              <div
                className="ops-energy-ledger"
                role="img"
                aria-label={`Full-horizon aggregate recovery: ${formatMwh(s.recovered!)} returned; ${formatMwh(s.unresolved!)} unrecovered. Not job completion.`}
              >
                <span className="returned" style={{ width: `${(100 * s.recovered!) / total}%` }} />
                <span
                  className="unrecovered"
                  style={{ width: `${(100 * s.unresolved!) / total}%` }}
                />
              </div>
              <div className="ops-ledger-labels">
                <span>
                  Returned <b>{formatMwh(s.recovered!)}</b>
                </span>
                <span>
                  Unrecovered <b>{formatMwh(s.unresolved!)}</b>
                </span>
              </div>
              <div className={`ops-recovery-action ${s.recoveryIncomplete ? "attention" : ""}`}>
                <p>
                  {s.recoveryIncomplete
                    ? `${formatMwh(s.unresolved!)} has no recovery slot within the permitted delay windows.`
                    : "Aggregate energy recovery is accounted for; job deadlines still require validation."}
                </p>
                <Link to="/operations" search={{ ...search, view: "compute", mode: "scenario" }}>
                  Review workload recovery →
                </Link>
              </div>
            </div>
          ) : (
            <p className="ops-no-obligation">No workload deferral in this response.</p>
          )}
          <dl className="ops-plan-checks">
            <div>
              <dt>Battery reserve</dt>
              <dd>
                {!s.usesBattery
                  ? "Not used in this response"
                  : s.minSoc == null
                    ? "Unavailable"
                    : `${s.reserveFailed ? "Constraint failed" : "Within configured SOC bounds"} · minimum ${formatPercent(s.minSoc)} / floor ${formatPercent(fullModel.scenario.battery.minimumSocPercent)}`}
              </dd>
              <dd>
                <Link to="/operations" search={{ ...search, view: "power", mode: "scenario" }}>
                  Inspect reserve →
                </Link>
              </dd>
            </div>
            <div>
              <dt>Job schedule</dt>
              <dd>Not validated</dd>
              <dd>
                <small>Energy recovery does not establish individual job completion.</small>
              </dd>
            </div>
          </dl>
        </>
      )}
      <footer>
        <span>Scenario only · Backup autonomy not validated · No physical control</span>
        <a
          href="#operations-assurance"
          onClick={() => {
            const node = document.getElementById("operations-assurance");
            if (node instanceof HTMLDetailsElement) node.open = true;
          }}
        >
          Evidence & assumptions
        </a>
      </footer>
    </section>
  );
}
