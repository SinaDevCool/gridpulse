import { jsPDF } from "jspdf";
import type { AnonymousProperty, AnonymousWorkspaceSettings } from "../anonymous-workspace/schema";
import {
  deriveQualification,
  decisionRecommendationLabel,
  qualificationLabels,
} from "../anonymous-workspace/data-centre-qualification";
import { projectAnonymousProperty } from "../anonymous-workspace/portfolio-projection";
import type { CapacityDossierProjection } from "./capacity-dossier";
import { capacityValue } from "./capacity-dossier";

export function buildDecisionPackageProjection(
  property: AnonymousProperty,
  dossier: CapacityDossierProjection,
  settings: AnonymousWorkspaceSettings,
) {
  const summary = projectAnonymousProperty(property);
  const qualification = deriveQualification(property);
  return {
    schema: "gridpulse.site-decision-package.v1",
    generatedAt: new Date().toISOString(),
    settings,
    property,
    dossier,
    summary,
    qualification,
    truthNotice:
      "Preliminary decision support. Grid screening does not establish capacity, feasibility, cost, connection point or delivery date. Only current validated operator evidence may support confirmed claims.",
  };
}

export function downloadClientDecisionPackage(
  property: AnonymousProperty,
  dossier: CapacityDossierProjection,
  settings: AnonymousWorkspaceSettings,
) {
  const data = buildDecisionPackageProjection(property, dossier, settings);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let y = 18;
  const footer = () => {
    pdf.setFontSize(7);
    pdf.setTextColor(90);
    pdf.text(settings.reportFooter, 15, 286, { maxWidth: 170 });
    pdf.text(`${pdf.getNumberOfPages()}`, 194, 286, { align: "right" });
    pdf.setTextColor(0);
  };
  const page = () => {
    footer();
    pdf.addPage();
    y = 18;
  };
  const heading = (value: string) => {
    if (y > 260) page();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(value, 15, y);
    y += 8;
  };
  const line = (label: string, value: unknown) => {
    if (y > 272) page();
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 15, y);
    pdf.setFont("helvetica", "normal");
    const wrapped = pdf.splitTextToSize(
      value == null || value === "" ? "Unknown" : String(value),
      125,
    );
    pdf.text(wrapped, 68, y);
    y += Math.max(6, wrapped.length * 4.5);
  };
  pdf.setFillColor(settings.accentColour || "#22d3ee");
  pdf.rect(0, 0, 8, 297, "F");
  pdf.setFontSize(9);
  pdf.setTextColor(75);
  pdf.text(settings.organisationName, 15, y);
  y += 8;
  pdf.setTextColor(0);
  pdf.setFontSize(21);
  pdf.setFont("helvetica", "bold");
  pdf.text("Data Centre Site Decision Package", 15, y);
  y += 10;
  pdf.setFontSize(14);
  pdf.text(property.name, 15, y);
  y += 8;
  line("Prepared for", settings.preparedFor || "Not specified");
  line("Classification", settings.confidentialityLabel);
  line("Recommendation", decisionRecommendationLabel(property).toUpperCase());
  line("Rationale", property.decisionRationale);
  line("Declared load", capacityValue(data.summary.requiredMw));
  line("Location", data.summary.locationLabel);
  heading("Executive recommendation");
  line("Next action", data.summary.nextAction);
  line("Open blockers", data.summary.blockers.join("; ") || "None recorded");
  heading("Data-centre qualification");
  line("Confirmed readiness", `${data.qualification.confirmedReadiness}%`);
  line("Screening coverage", `${data.qualification.screeningCoverage}%`);
  line("Constraints detected", data.qualification.constraintsDetected);
  data.qualification.dimensions.forEach((item) =>
    line(
      qualificationLabels[item.key],
      `${item.status.toUpperCase()} — ${item.summary ?? "No finding recorded"}${item.unsupported ? " (accepted evidence missing)" : ""}`,
    ),
  );
  heading("Grid screening");
  line("Recommended for investigation", data.summary.recommendedCandidate?.nodeName);
  line("User-shortlisted candidate", data.summary.preferredCandidate?.nodeName);
  line("Likely operator", data.summary.operator);
  line("N-1 firm", capacityValue(dossier.dossier.n1_firm_capacity_mw));
  line("Validation", dossier.dossier.validation_status);
  line(
    "Validity",
    `${dossier.dossier.valid_from ?? "Unknown"} to ${dossier.dossier.valid_to ?? "Unknown"}`,
  );
  heading("Operator engagement");
  const engagement = property.operatorEngagement!;
  line("Operator", engagement.operatorName);
  line("Responsibility", engagement.responsibilityStatus);
  line("Enquiry status", engagement.enquiryStatus);
  line("Reference", engagement.enquiryReference);
  line("Indicated connection point", engagement.indicatedConnectionPoint);
  line(
    "Indicated cost",
    engagement.indicatedCostEur == null
      ? "Unknown"
      : `EUR ${engagement.indicatedCostEur.toLocaleString("en-GB")}`,
  );
  line("Indicated delivery", engagement.indicatedDeliveryDate);
  heading("Evidence register");
  (property.evidenceRegister ?? []).forEach((item) =>
    line(
      item.title,
      `${item.claim} [${item.evidenceClass}; ${item.validationStatus}${item.validTo ? `; valid to ${item.validTo}` : ""}]`,
    ),
  );
  heading("Automatic source coverage");
  (property.enrichmentRuns?.[0]?.sourceResults ?? []).forEach((source) =>
    line(
      source.source,
      `${source.status}; ${source.findingCount} finding(s); release ${source.releaseId ?? "not reported"}${source.limitation ? `; ${source.limitation}` : ""}`,
    ),
  );
  heading("Limitations");
  line("Truth boundary", data.truthNotice);
  footer();
  pdf.save(`${property.name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}-decision-package.pdf`);
}
