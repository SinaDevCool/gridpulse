import { CheckCircle2, ExternalLink } from "lucide-react";
import type { FinderControllerContract } from "./controller-contract";
export function FinderOperatorEvidence({ model }: { model: FinderControllerContract }) {
  const { dataMode, operatorEvidence, operatorEvidenceState } = model;
  return (
    <section className="power-finder-operator-evidence" aria-label="Official operator evidence">
      <p>
        {operatorEvidence?.match_state === "accepted_node_evidence"
          ? "Reviewed node match"
          : operatorEvidence?.match_state === "operator_context_only"
            ? "Operator-level context"
            : "No reviewed node evidence"}
      </p>
      {operatorEvidenceState === "loading" && <p>Checking accepted evidence…</p>}
      {operatorEvidenceState === "unavailable" && (
        <p>Evidence service is temporarily unavailable.</p>
      )}
      {operatorEvidenceState === "idle" && dataMode === "published_artifact" && (
        <p>Operator source inspection is not included in the public Finder.</p>
      )}
      {operatorEvidenceState === "ready" &&
        (operatorEvidence?.items.length ? (
          <ul>
            {operatorEvidence.items.map((item) => (
              <li key={`${item.scope}-${item.url}`}>
                <span>
                  {item.scope === "node_match" && <CheckCircle2 aria-label="Reviewed node match" />}
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title} <ExternalLink aria-hidden="true" />
                  </a>
                </span>
                <small>{item.scope === "node_match" ? item.rationale : item.legal_boundary}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No official publication is linked to this mapped node. Capacity remains unknown until
            the responsible operator responds.
          </p>
        ))}
      <footer>
        Operator-level pages explain process or network context. They do not establish capacity at
        this node.
      </footer>
    </section>
  );
}
