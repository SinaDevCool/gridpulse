import { CircleAlert } from "lucide-react";
import {
  evidenceClassDescription,
  PRODUCT_SCOPE_NOTICE,
} from "@/features/grid-connection/product-truth";
import { evidenceClassLabel } from "@/features/grid-connection/evidence";
import type { EvidenceClass } from "@/features/grid-connection/domain";

const classes: EvidenceClass[] = [
  "customer_declared",
  "public_source",
  "derived",
  "operator_confirmed",
];

export function ProductTruthNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={`product-truth${compact ? " product-truth--compact" : ""}`}
      aria-label="Evidence and product scope"
    >
      <div className="product-truth-heading">
        <CircleAlert size={17} aria-hidden="true" />
        <div>
          <strong>Evidence status controls every conclusion</strong>
          <p>{PRODUCT_SCOPE_NOTICE}</p>
        </div>
      </div>
      {!compact ? (
        <div className="product-truth-legend">
          {classes.map((evidenceClass) => (
            <div key={evidenceClass}>
              <span className={`truth-dot is-${evidenceClass}`} />
              <p>
                <strong>{evidenceClassLabel[evidenceClass]}</strong>
                <small>{evidenceClassDescription[evidenceClass]}</small>
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
