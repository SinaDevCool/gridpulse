import { useState } from "react";
import {
  deriveQualification,
  qualificationLabels,
} from "../anonymous-workspace/data-centre-qualification";
import { qualificationDimensionKeys, type AnonymousProperty } from "../anonymous-workspace/schema";
import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProject } from "./finder-project";
import { buildGermanOperatorEnquiry } from "./operator-enquiry";
import { buildScreeningEvidenceReceipt } from "./evidence-receipt";

export function GermanSiteEvidence({
  project,
  candidate,
  property,
}: {
  project: FinderProject;
  candidate: CandidateOpportunity;
  property: AnonymousProperty | null;
}) {
  const [notice, setNotice] = useState("");
  const qualification = property ? deriveQualification(property) : null;
  const enquiry = buildGermanOperatorEnquiry(project, candidate);
  const receipt = buildScreeningEvidenceReceipt(candidate);
  return (
    <details className="finder-site-evidence">
      <summary>German site evidence &amp; operator enquiry</summary>
      <p>
        Mapping is an investigation lead. Land, planning, flood, fibre, cooling and heat-reuse
        evidence require site-specific review.
      </p>
      <dl>
        {qualificationDimensionKeys.map((key) => {
          const item = qualification?.dimensions.find((dimension) => dimension.key === key);
          return (
            <div key={key}>
              <dt>{qualificationLabels[key]}</dt>
              <dd>
                {!item || item.status === "unknown"
                  ? "Not assessed"
                  : item.unsupported
                    ? "Awaiting supporting evidence"
                    : item.status}
              </dd>
            </div>
          );
        })}
      </dl>
      <p>
        Public generation and broadband coverage do not establish a supply agreement, diverse
        carrier routes or available import MW.
      </p>
      <label>
        Draft operator enquiry
        <textarea readOnly rows={10} value={enquiry} />
      </label>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(enquiry);
            setNotice("Enquiry copied. Review it before sending to the responsible operator.");
          } catch {
            setNotice("Select and copy the draft text above. Nothing has been sent.");
          }
        }}
      >
        Copy draft enquiry
      </button>
      <p role="status">{notice}</p>
      <details>
        <summary>Screening evidence receipt</summary>
        <p>
          Keep the source identifiers and method with this investigation. A receipt does not
          establish available capacity or retain the original source data.
        </p>
        <label>
          Screening evidence receipt text
          <textarea readOnly rows={8} value={receipt} />
        </label>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(receipt);
              setNotice("Evidence receipt copied. Review it before sharing.");
            } catch {
              setNotice("Select and copy the receipt text above.");
            }
          }}
        >
          Copy evidence receipt
        </button>
      </details>
      <a href="/data-sources">Review German sources and evidence limitations</a>
    </details>
  );
}
