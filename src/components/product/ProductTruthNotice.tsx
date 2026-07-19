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

export function ProductTruthNotice() {
  return (
    <aside className="product-truth" aria-label="Evidence and product scope">
      <div className="product-truth-heading">
        <CircleAlert size={17} />
        <div>
          <strong>Evidence status controls every conclusion</strong>
          <p>{PRODUCT_SCOPE_NOTICE}</p>
        </div>
      </div>
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
    </aside>
  );
}
