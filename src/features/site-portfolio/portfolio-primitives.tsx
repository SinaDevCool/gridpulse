import { stageLabel } from "./workspace-export";
import {
  projectAnonymousProperty,
  type AnonymousSiteStage,
} from "@/features/anonymous-workspace/portfolio-projection";
import { suggestScreeningVoltage } from "@/features/power-finder/site-screening-context";
import { portfolioStageLabels } from "@/features/site-portfolio/portfolio-status";
import { Link } from "@tanstack/react-router";
import { Trash2, X } from "lucide-react";
export function Metric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function SiteDetail({
  site,
  onClose,
  onDeleted,
}: {
  site: ReturnType<typeof projectAnonymousProperty>;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  return (
    <aside className="site-detail-panel" aria-label={`${site.name} details`}>
      <header>
        <div>
          <p className="context-label">Selected Site</p>
          <h2>{site.name}</h2>
          <p>{site.locationLabel}</p>
        </div>
        <button type="button" aria-label="Close site details" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="detail-status-line">
        <span className={`decision-chip is-${site.decisionStatus}`}>{site.decisionStatus}</span>
        <span>{stageLabel[site.stage]}</span>
        <span>{site.requiredMw} MW required</span>
      </div>
      <dl className="detail-location-summary">
        <div>
          <dt>Site label</dt>
          <dd>{site.property.siteLabel ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Municipality</dt>
          <dd>{site.property.municipality ?? "Not recorded"}</dd>
        </div>
      </dl>
      <section>
        <h3>Screening Snapshot</h3>
        <dl>
          <div>
            <dt>Public sources</dt>
            <dd>{site.property.enrichmentRuns?.[0]?.completedSources.length ?? 0} checked</dd>
          </div>
          <div>
            <dt>Grid candidates</dt>
            <dd>{site.candidateCount}</dd>
          </div>
          <div>
            <dt>Screening coverage</dt>
            <dd>{site.screeningCoverage}%</dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>{site.operator ?? "Unconfirmed"}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>
              {site.capacityState === "validated" ? "Validated evidence attached" : "Unknown"}
            </dd>
          </div>
          <div>
            <dt>Land control</dt>
            <dd>{site.property.landControlStatus}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>Recommended Connection Hypothesis</h3>
        <p>
          <b>{site.recommendedCandidate?.nodeName ?? "Not yet screened"}</b>
          {site.recommendedCandidate
            ? ` · ${site.recommendedCandidate.distanceKm.toFixed(1)} km · ${site.recommendedCandidate.screeningRank.toFixed(0)}/100 investigation score`
            : ""}
        </p>
        <small>Recommended for investigation—not a capacity offer.</small>
      </section>
      <section>
        <h3>Checks Before Decision</h3>
        <ul className="detail-blockers">
          {site.checksRemaining.slice(0, 6).map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
        <p className="next-action">
          <b>Recommended Next Step:</b> {site.nextAction}
        </p>
      </section>
      <section className="site-decision-form detail-decision-summary">
        <h3>Client Decision</h3>
        <div className="detail-decision-current">
          <span className={`decision-chip is-${site.decisionStatus}`}>{site.decisionStatus}</span>
          <p>{site.property.decisionRationale ?? "No rationale recorded yet."}</p>
        </div>
        <Link
          className="primary-button"
          to="/portfolio/$id"
          params={{ id: site.id }}
          search={{ tab: "decision" }}
        >
          Review Decision
        </Link>
      </section>
      <footer>
        <Link
          to="/power-finder"
          search={{
            propertyId: site.id,
            lat: site.property.project.latitude ?? undefined,
            lng: site.property.project.longitude ?? undefined,
            mw: site.property.project.importMw,
            projectType: site.property.project.type,
            voltage: suggestScreeningVoltage(
              site.property.project.importMw,
              site.property.project.type,
              site.property.project.preferredVoltageKv,
            ),
            preferredVoltage: suggestScreeningVoltage(
              site.property.project.importMw,
              site.property.project.type,
              site.property.project.preferredVoltageKv,
            ),
          }}
        >
          Review in Power Finder
        </Link>
        <Link to="/portfolio/$id" params={{ id: site.id }} search={{ tab: "overview" }}>
          Open Site Workspace
        </Link>
        <Link to="/capacity-dossiers/$id" params={{ id: site.id }}>
          Export Record
        </Link>
        <button
          type="button"
          className="danger-action"
          onClick={async () => {
            if (!window.confirm(`Delete ${site.name} from this browser?`)) return;
            await onDeleted();
          }}
        >
          <Trash2 /> Delete
        </button>
      </footer>
    </aside>
  );
}
