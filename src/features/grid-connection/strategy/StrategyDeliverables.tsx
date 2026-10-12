import { Download, ShieldAlert } from "lucide-react";
import { CommercialDecisionGate } from "../CommercialDecisionGate";
import { buildDecisionMemo, downloadJson } from "../deliverables";
import { downloadOperatorPackagePdf } from "../operator-pdf";
import type { StrategyControllerContract } from "./controller-contract";
export function StrategyDeliverables({ model }: { model: StrategyControllerContract }) {
  const {
    busy,
    strategyRecords,
    candidates,
    packages,
    metrics,
    preferredScenario,
    result,
    packageGate,
    decisionMatrix,
    preferredOption,
    snapshot,
    persistPackage,
    saveDecision,
    savePilotSnapshot,
    site,
    evidence,
  } = model;
  return (
    <div className="strategy-grid deliverables-grid">
      <CommercialDecisionGate
        site={site}
        preferredOption={preferredOption}
        estimatedConnectionCostEur={
          strategyRecords?.engagement?.estimated_connection_cost_eur ?? null
        }
        indicatedConnectionDate={strategyRecords?.engagement?.indicated_connection_date ?? null}
      />
      <article className="strategy-card">
        <p className="context-label">Operator engagement package</p>
        <h3>{packageGate.ready ? "Ready to issue" : "Draft blocked"}</h3>
        {packageGate.blockers.map((blocker) => (
          <p className="model-warning" key={blocker}>
            <ShieldAlert />
            {blocker}
          </p>
        ))}
        <p>
          Structured project requirements, evidence register, scenarios, FCA result and operator
          questions.
        </p>
        <div className="package-actions">
          <button onClick={() => persistPackage("draft")} disabled={busy}>
            Save controlled draft
          </button>
          <button onClick={() => persistPackage("internal_review")} disabled={busy}>
            Send to internal review
          </button>
          <button onClick={() => persistPackage("approved")} disabled={busy || !packageGate.ready}>
            Approve package
          </button>
          <button onClick={() => persistPackage("issued")} disabled={busy || !packageGate.ready}>
            Issue next version
          </button>
          <button onClick={() => downloadJson(`${site.name}-operator-package.json`, snapshot)}>
            <Download /> Download snapshot
          </button>
          <button
            onClick={() =>
              downloadOperatorPackagePdf(snapshot, {
                version: (packages[0]?.version ?? 0) + 1,
                status: packageGate.ready ? "review draft" : "blocked draft",
                preferredStrategy: preferredScenario?.name,
                rationale: preferredScenario?.selection_rationale ?? undefined,
              })
            }
          >
            <Download /> Download A4 PDF
          </button>
        </div>
        {packages.length ? (
          <div className="package-history">
            {packages.slice(0, 5).map((item) => (
              <span key={item.id}>
                v{item.version} · {item.status} ·{" "}
                {new Date(item.created_at).toLocaleDateString("en-GB")}
              </span>
            ))}
          </div>
        ) : null}
      </article>
      <article className="strategy-card">
        <p className="context-label">Traceable decision memo</p>
        <h3>{result.compatible ? "Proceed to operator study" : "Revise the strategy"}</h3>
        <p>Records the recommendation, reasons, limitations, evidence register and next actions.</p>
        <button
          onClick={() =>
            downloadJson(`${site.name}-decision-memo.json`, buildDecisionMemo(snapshot))
          }
        >
          <Download /> Download decision memo
        </button>
        <button onClick={saveDecision} disabled={busy || !preferredScenario}>
          Save versioned decision record
        </button>
      </article>
      <article className="strategy-card pilot-outcomes-card">
        <p className="context-label">Pilot outcome measurement</p>
        <h3>Prove process value without claiming grid capacity</h3>
        <dl className="strategy-facts">
          <div>
            <dt>Evidence completion</dt>
            <dd>
              {Math.round(
                (evidence.filter((item) => item.validation_status === "validated").length /
                  Math.max(1, evidence.length)) *
                  100,
              )}
              %
            </dd>
          </div>
          <div>
            <dt>Sites compared</dt>
            <dd>{Math.max(1, candidates.length + 1)}</dd>
          </div>
          <div>
            <dt>Options evaluated</dt>
            <dd>{decisionMatrix.length}</dd>
          </div>
          <div>
            <dt>Snapshots recorded</dt>
            <dd>{new Set(metrics.map((item) => item.observed_at)).size}</dd>
          </div>
        </dl>
        <p>
          Use repeated snapshots to show fewer evidence gaps, fewer unresolved operator questions
          and faster package preparation during a German pilot.
        </p>
        <button onClick={savePilotSnapshot} disabled={busy}>
          Save outcome snapshot
        </button>
      </article>
    </div>
  );
}
