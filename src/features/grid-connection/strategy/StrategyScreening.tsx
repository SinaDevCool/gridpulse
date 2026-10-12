import { Check, MapPin, ShieldAlert } from "lucide-react";
import { assessCandidateDimensions } from "../site-comparison";
import { candidateMaturitySummary } from "./presentation";
import type { StrategyControllerContract } from "./controller-contract";
export function StrategyScreening({ model }: { model: StrategyControllerContract }) {
  const { candidateBusy, input, candidates, maturity, operator, addCandidate, site, profiles } =
    model;
  return (
    <div className="strategy-grid">
      <article className="strategy-card map-card">
        <MapPin />
        <p className="context-label">Declared location</p>
        <h3>{site.municipality || site.name}</h3>
        <p>
          {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)} ·{" "}
          {site.federal_state || "Federal state not recorded"}
        </p>
        <div className="coordinate-map" aria-label="Location screening illustration">
          <span
            style={{
              left: `${((site.longitude - 5) / 11) * 100}%`,
              top: `${((56 - site.latitude) / 9) * 100}%`,
            }}
          />
        </div>
        <small>Geographic context only—this is not a capacity map.</small>
      </article>
      <article className="strategy-card">
        <p className="context-label">Likely transmission context</p>
        <h3>{operator.transmissionOperator}</h3>
        <p>{operator.regionalContext}</p>
        <dl className="strategy-facts">
          <div>
            <dt>Confidence</dt>
            <dd>Screening only</dd>
          </div>
          <div>
            <dt>Distribution operator</dt>
            <dd>Must be independently confirmed</dd>
          </div>
          <div>
            <dt>Target voltage</dt>
            <dd>{site.target_voltage_kv ? `${site.target_voltage_kv} kV` : "Not declared"}</dd>
          </div>
        </dl>
      </article>
      <article className="strategy-card">
        <p className="context-label">Project maturity</p>
        <strong className="strategy-score">{maturity.score}%</strong>
        <div className="maturity-list">
          {maturity.checks.map((check) => (
            <span key={check.key} className={check.ready ? "done" : ""}>
              {check.ready ? <Check /> : <ShieldAlert />}
              {check.key.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </article>
      <article className="strategy-card candidate-comparison-card">
        <div className="candidate-card-heading">
          <div>
            <p className="context-label">Candidate comparison</p>
            <h3>Compare locations before committing to one queue</h3>
          </div>
          <small>Public-context screening only</small>
        </div>
        <form className="candidate-form" onSubmit={addCandidate}>
          <label>
            Candidate name
            <input name="name" required placeholder="e.g. Leipzig alternative" />
          </label>
          <label>
            Municipality
            <input name="municipality" placeholder="Leipzig" />
          </label>
          <label>
            Federal state
            <input name="federalState" placeholder="Saxony" />
          </label>
          <label>
            Latitude
            <input name="latitude" type="number" step="0.0001" min="47" max="56" required />
          </label>
          <label>
            Longitude
            <input name="longitude" type="number" step="0.0001" min="5" max="16" required />
          </label>
          <label>
            Target voltage (kV)
            <input name="targetVoltageKv" type="number" min="0" step="1" />
          </label>
          <label>
            Land status
            <select name="landStatus" defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="identified">Identified</option>
              <option value="optioned">Optioned</option>
              <option value="controlled">Controlled</option>
            </select>
          </label>
          <label>
            Planning status
            <select name="planningStatus" defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="not_started">Not started</option>
              <option value="pre_application">Pre-application</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>
          </label>
          <label>
            Cable route
            <select name="cableRouteStatus" defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="indicative">Indicative</option>
              <option value="secured">Secured</option>
            </select>
          </label>
          <label>
            Financing
            <select name="financeStatus" defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="indicative">Indicative</option>
              <option value="committed">Committed</option>
            </select>
          </label>
          <label className="candidate-checkbox">
            <input name="singleLineDiagramReady" type="checkbox" />
            Single-line diagram ready
          </label>
          <button type="submit" disabled={candidateBusy}>
            <MapPin /> Add candidate
          </button>
        </form>
        {candidates.length ? (
          <div className="candidate-table" role="table" aria-label="Candidate site comparison">
            <div className="candidate-row candidate-header" role="row">
              <span>Site</span>
              <span>Likely TSO</span>
              <span>Voltage</span>
              <span>Maturity</span>
              <span>Decision factors</span>
              <span>Status</span>
            </div>
            {candidates.map((candidate) => {
              const dimensions = assessCandidateDimensions(candidate, profiles.length > 0);
              return (
                <div className="candidate-row" role="row" key={candidate.id}>
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.municipality || "Location declared"}</small>
                  </span>
                  <span>{candidate.likely_tso || "Unscreened"}</span>
                  <span>
                    {candidate.target_voltage_kv ? `${candidate.target_voltage_kv} kV` : "Open"}
                  </span>
                  <span>
                    <strong>{candidate.maturity_score}%</strong>
                    <small>{candidateMaturitySummary(candidate)}</small>
                  </span>
                  <span>
                    <strong>Evidence {dimensions.evidenceCompleteness}%</strong>
                    <small>
                      Operator {dimensions.operatorReadiness}% · Fit{" "}
                      {dimensions.operationalFit.replaceAll("_", " ")}
                    </small>
                    <small>Next: {dimensions.nextAction}</small>
                  </span>
                  <span>{candidate.screening_status.replaceAll("_", " ")}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-strategy-state">No alternative candidate sites recorded yet.</p>
        )}
      </article>
    </div>
  );
}
