import { GitBranch, MapPin, ShieldCheck } from "lucide-react";
import { publicSelectedAsset } from "./selected-asset-data";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function SelectedAssetContext({ stage }: { stage: "activation" | "operations" }) {
  return (
    <section className="selected-asset-context" aria-labelledby="selected-asset-title">
      <div className="selected-asset-identity">
        <MapPin aria-hidden="true" />
        <div>
          <p className="context-label">Selected Connection Basis</p>
          <h2 id="selected-asset-title">{publicSelectedAsset.name}</h2>
          <span>
            {publicSelectedAsset.nodeId} · {publicSelectedAsset.operator}
          </span>
        </div>
      </div>
      <dl>
        <div>
          <dt>N-0 ceiling</dt>
          <dd>{number.format(publicSelectedAsset.n0Mw)} MW</dd>
        </div>
        <div>
          <dt>N-1 firm basis</dt>
          <dd>{number.format(publicSelectedAsset.firmMw)} MW</dd>
        </div>
        <div>
          <dt>Binding constraint</dt>
          <dd>{publicSelectedAsset.bindingConstraint}</dd>
        </div>
      </dl>
      <div className="selected-asset-lineage">
        <GitBranch aria-hidden="true" />
        <span>Find Capacity</span>
        <i aria-hidden="true" />
        <strong>{stage === "activation" ? "Shape Envelope" : "Frozen Envelope"}</strong>
        <i aria-hidden="true" />
        <span>{stage === "activation" ? "Operations" : "Monitor Limit"}</span>
      </div>
      <p className="selected-asset-evidence">
        <ShieldCheck aria-hidden="true" /> {publicSelectedAsset.evidence}. The MW basis is a
        demonstration result, not an operator capacity offer.
      </p>
    </section>
  );
}
