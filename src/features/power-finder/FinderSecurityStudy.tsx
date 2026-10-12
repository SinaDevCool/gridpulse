import type { FinderControllerContract } from "./controller-contract";
export function FinderSecurityStudy({ model }: { model: FinderControllerContract }) {
  const { c1Study } = model;
  if (!c1Study?.c3?.available) return null;
  return (
    <details className="candidate-advanced-study">
      <summary>Security &amp; flexibility study</summary>
      <section className="finder-panel-card finder-panel-card--study">
        <p>This result is linked to an operator-reviewed model for the selected node.</p>
        <dl>
          <div>
            <dt>Firm import</dt>
            <dd>
              {c1Study.c3.security?.import_capacity?.values?.firm_import_capacity_mw ?? "—"} MW
            </dd>
          </div>
          <div>
            <dt>Firm export</dt>
            <dd>
              {c1Study.c3.security?.export_capacity?.values?.firm_export_capacity_mw ?? "—"} MW
            </dd>
          </div>
          <div>
            <dt>Contingencies assessed</dt>
            <dd>{c1Study.c3.security?.contingency_coverage?.assessed_count ?? 0}</dd>
          </div>
          <div>
            <dt>Constrained hours</dt>
            <dd>{c1Study.c3.flexibilitySummary?.constrained_hours?.toLocaleString() ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </details>
  );
}
