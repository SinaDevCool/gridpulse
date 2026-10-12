import { CheckCircle2,Map } from "lucide-react";

import { type AnonymousProperty } from "@/features/anonymous-workspace/schema";

import {
decisionRecommendationLabel,
deriveQualification,
qualificationLabels,
} from "@/features/anonymous-workspace/data-centre-qualification";

import { numberOrNull } from "./presentation";

export function Overview({
  property,
  candidateName,
  candidateShortlisted,
  onSave,
}: {
  property: AnonymousProperty;
  candidateName: string | null;
  candidateShortlisted: boolean;
  onSave: (p: AnonymousProperty) => Promise<void>;
}) {
  const profile = property.dataCentreProfile!;
  const qualification = deriveQualification(property);
  const constraints = qualification.dimensions.filter((item) => item.status === "adverse");
  const supportingReasons = [
    `${property.requiredTotalSiteLoadMw ?? property.project.importMw} MW client-declared requirement`,
    candidateName ? `${candidateName} mapped as a connection hypothesis` : null,
    property.municipality ? `${property.municipality} municipality identified` : null,
  ].filter(Boolean) as string[];
  return (
    <>
      <header className="workspace-section-heading">
        <div>
          <p className="context-label">Property Brief</p>
          <h2>Opportunity Overview</h2>
          <p>Understand the opportunity, material concerns and next investigation step.</p>
        </div>
      </header>
      <section className="overview-executive" aria-label="Executive property summary">
        <article className="overview-recommendation">
          <span>Current position</span>
          <strong>{decisionRecommendationLabel(property)}</strong>
          <p>
            {property.decisionRationale ??
              "Review the available context before recording an Advance, Hold or Reject decision."}
          </p>
        </article>
        <article>
          <span>Why investigate</span>
          <ul>
            {supportingReasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>
        <article>
          <span>Material concerns</span>
          <ul>
            {constraints.length ? (
              constraints
                .slice(0, 3)
                .map((item) => (
                  <li key={item.key}>{qualificationLabels[item.key]} constraint detected</li>
                ))
            ) : (
              <li>{qualification.checksRemaining} checks still require review or evidence.</li>
            )}
          </ul>
        </article>
      </section>
      <form
        className="workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onSave({
            ...property,
            name: String(form.get("name")),
            municipality: String(form.get("municipality")) || null,
            siteLabel: String(form.get("address")) || null,
            requiredItLoadMw: numberOrNull(form.get("itLoad")),
            requiredTotalSiteLoadMw: numberOrNull(form.get("totalLoad")),
            landControlStatus: String(form.get("land")) as AnonymousProperty["landControlStatus"],
            dataCentreProfile: {
              ...profile,
              address: String(form.get("address")) || null,
              federalState: String(form.get("state")) || null,
              cadastralReference: String(form.get("cadastre")) || null,
              siteAreaHectares: numberOrNull(form.get("area")),
              developableAreaHectares: numberOrNull(form.get("developable")),
              minimumViableLoadMw: numberOrNull(form.get("minimumMw")),
              targetEnergisationDate: String(form.get("date")) || null,
              transactionStructure: String(
                form.get("transaction"),
              ) as typeof profile.transactionStructure,
            },
          });
        }}
      >
        <section className="workspace-form-section">
          <header>
            <h3>Site identity</h3>
            <p>Location and land reference</p>
          </header>
          <div className="form-grid">
            <label>
              Site name
              <input name="name" required defaultValue={property.name} />
            </label>
            <label>
              Address / site label
              <input name="address" defaultValue={profile.address ?? ""} />
            </label>
            <label>
              Municipality
              <input name="municipality" defaultValue={property.municipality ?? ""} />
            </label>
            <label>
              Federal state
              <input name="state" defaultValue={profile.federalState ?? ""} />
            </label>
            <label>
              Cadastral reference
              <input name="cadastre" defaultValue={profile.cadastralReference ?? ""} />
            </label>
          </div>
        </section>
        <section className="workspace-form-section">
          <header>
            <h3>Scale and power</h3>
            <p>Declared requirements, not available capacity</p>
          </header>
          <div className="form-grid">
            <label>
              Site area (ha)
              <input
                name="area"
                type="number"
                min="0"
                step="0.01"
                defaultValue={profile.siteAreaHectares ?? ""}
              />
            </label>
            <label>
              Developable area (ha)
              <input
                name="developable"
                type="number"
                min="0"
                step="0.01"
                defaultValue={profile.developableAreaHectares ?? ""}
              />
            </label>
            <label>
              IT load (MW)
              <input
                name="itLoad"
                type="number"
                min="0"
                step="0.1"
                defaultValue={property.requiredItLoadMw ?? ""}
              />
            </label>
            <label>
              Total site load (MW)
              <input
                name="totalLoad"
                required
                type="number"
                min="0"
                step="0.1"
                defaultValue={property.requiredTotalSiteLoadMw ?? property.project.importMw}
              />
            </label>
            <label>
              Minimum viable load (MW)
              <input
                name="minimumMw"
                type="number"
                min="0"
                step="0.1"
                defaultValue={profile.minimumViableLoadMw ?? ""}
              />
            </label>
          </div>
        </section>
        <section className="workspace-form-section">
          <header>
            <h3>Delivery position</h3>
            <p>Commercial assumptions supplied by the client</p>
          </header>
          <div className="form-grid">
            <label>
              Target energisation
              <input name="date" type="date" defaultValue={profile.targetEnergisationDate ?? ""} />
            </label>
            <label>
              Land control
              <select name="land" defaultValue={property.landControlStatus}>
                <option value="unknown">Unknown</option>
                <option value="identified">Identified</option>
                <option value="optioned">Optioned</option>
                <option value="controlled">Controlled</option>
              </select>
            </label>
            <label>
              Transaction
              <select name="transaction" defaultValue={profile.transactionStructure}>
                <option value="unknown">Unknown</option>
                <option value="purchase">Purchase</option>
                <option value="lease">Lease</option>
                <option value="option">Option</option>
                <option value="joint_venture">Joint venture</option>
              </select>
            </label>
          </div>
        </section>
        <div className="workspace-callout">
          <Map />{" "}
          <div>
            <b>
              {candidateShortlisted ? "Shortlisted grid hypothesis" : "Recommended grid hypothesis"}
            </b>
            <span>
              {candidateName ?? "No connection hypothesis yet — continue in Power Finder."}
              {!candidateShortlisted && candidateName ? " · review before shortlisting" : ""}
            </span>
          </div>
        </div>
        <footer className="workspace-form-actions">
          <button className="primary-action" type="submit">
            <CheckCircle2 aria-hidden="true" /> Save site brief
          </button>
        </footer>
      </form>
    </>
  );
}
