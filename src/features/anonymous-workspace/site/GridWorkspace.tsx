import { Link } from "@tanstack/react-router";

import { Map,ShieldAlert } from "lucide-react";

import { type AnonymousProperty } from "@/features/anonymous-workspace/schema";

export function GridWorkspace({
  property,
  candidateName,
  recommendedName,
  onSave,
}: {
  property: AnonymousProperty;
  candidateName: string | null;
  recommendedName: string | null;
  onSave: (p: AnonymousProperty, m?: string) => Promise<void>;
}) {
  const shortlistCandidate = (candidateId: string, candidateLabel: string) =>
    onSave(
      {
        ...property,
        preferredCandidateId: candidateId,
        selectedCandidateIds: Array.from(new Set([...property.selectedCandidateIds, candidateId])),
        gridScreeningSnapshots: (property.gridScreeningSnapshots ?? []).map((snapshot, index) =>
          index === 0 ? { ...snapshot, shortlistedCandidateId: candidateId } : snapshot,
        ),
      },
      `${candidateLabel} shortlisted as the connection hypothesis`,
    );

  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Connection hypotheses</p>
          <h2>Power Options</h2>
          <p>
            Power Finder remains the single screening engine. This page summarises its saved output.
          </p>
        </div>
        <Link
          className="primary-action grid-open-finder"
          to="/power-finder"
          search={{
            propertyId: property.id,
            lng: property.project.longitude,
            lat: property.project.latitude,
            mw: property.project.importMw,
            projectType: property.project.type,
            candidate: property.preferredCandidateId ?? undefined,
          }}
        >
          <Map aria-hidden="true" /> Investigate on Map
        </Link>
      </header>
      <div className="grid-truth-note">
        <ShieldAlert aria-hidden="true" />
        <span>
          Candidate ranking is an investigation aid. Capacity, feasibility, cost, and programme
          require operator confirmation.
        </span>
      </div>
      <div className="workspace-facts">
        <article>
          <span>Recommended for investigation</span>
          <strong>{recommendedName ?? "Not screened"}</strong>
          <small>Not a capacity offer.</small>
        </article>
        <article>
          <span>Shortlisted candidate</span>
          <strong>{candidateName ?? "Not selected"}</strong>
        </article>
        <article>
          <span>Candidate snapshots</span>
          <strong>{property.candidateSnapshots.length}</strong>
        </article>
        <article>
          <span>Likely operator</span>
          <strong>{property.operatorEngagement!.operatorName ?? "Unconfirmed"}</strong>
        </article>
        <article>
          <span>Capacity</span>
          <strong>
            {property.evidence?.validationStatus === "validated"
              ? "Validated evidence"
              : "Not established"}
          </strong>
        </article>
      </div>
      <div className="grid-candidate-heading">
        <div>
          <p className="context-label">Mapped alternatives</p>
          <h3>Candidate comparison</h3>
        </div>
        {property.recommendedCandidateId &&
        property.recommendedCandidateId !== property.preferredCandidateId ? (
          <button
            type="button"
            className="primary-action shortlist-candidate-action"
            onClick={() =>
              void shortlistCandidate(
                property.recommendedCandidateId!,
                recommendedName ?? "Candidate",
              )
            }
          >
            Shortlist recommended candidate
          </button>
        ) : null}
      </div>
      <div className="candidate-table-wrap">
        <table className="candidate-table">
          <caption className="sr-only">Grid candidate comparison</caption>
          <thead>
            <tr>
              <th scope="col">Candidate</th>
              <th scope="col">Distance</th>
              <th scope="col">Likely Operator</th>
              <th scope="col">Selection</th>
            </tr>
          </thead>
          <tbody>
            {property.candidateSnapshots.map((item) => {
              const preferred = item.id === property.preferredCandidateId;
              return (
                <tr key={item.id} className={preferred ? "preferred" : ""}>
                  <th scope="row">{item.nodeName}</th>
                  <td>{item.distanceKm.toFixed(1)} km</td>
                  <td>{item.operator ?? "Operator unknown"}</td>
                  <td>
                    {preferred ? (
                      <span className="candidate-status">Shortlisted</span>
                    ) : (
                      <button
                        type="button"
                        className="candidate-select-action"
                        onClick={() => void shortlistCandidate(item.id, item.nodeName)}
                      >
                        Shortlist Instead
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
